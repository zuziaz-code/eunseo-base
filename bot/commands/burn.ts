import { SlashCommandBuilder } from 'discord.js';
import Discord, { Message, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import { GachaManager } from '../gachamanager'
import { Database } from '../database'
import { Card } from '../types/card';
import { Prices } from '../prices';
import { GUI } from '../core/gui';
import { Filters } from '../utils/filters';

interface BurnedCards {
    [userId: string]: Card[];
}

const self = module.exports = {
    burned_cards: {} as BurnedCards,
    data: new SlashCommandBuilder()
        .setName('burn')
        .setDescription('Burn a card and get `🥜`')
        .addSubcommand(subcommand =>
            subcommand
                .setName('last')
                .setDescription('Burn the last card(s) you got')
                .addNumberOption(option => option.setName('number').setDescription('Number of last cards you want to burn')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cards')
                .setDescription('Burn specific card(s) by ID')
                .addStringOption(option => option.setName('card_ids').setDescription('List of card IDs to burn (separated by spaces)').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('all')
                .setDescription('Burn all your non-favorite cards')),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
        const subcommand = message.options.getSubcommand(),
            card_ids = message.options.getString('card_ids')
        let nb_burns = message.options.getNumber('number') || 1
        if (!Number.isInteger(nb_burns)) {
            Channel.replyNegative(message, "You must enter only whole numbers.")
            return
        }

        if (subcommand == "all") {
            await self.sendConfirmBurnAllMessage(user, message, dataManager, gacha)
        } else {
            if (subcommand == "last") {
                if (nb_burns == null) {
                    nb_burns = 1
                }
                if (nb_burns <= 0 || nb_burns > 10) {
                    Channel.replyNegative(message, "Min 1 / Max 10 burns at a time.")
                    return
                }
            }
            const inv = await dataManager.getInventory(user.id,)
            const favs = await dataManager.getFavs(user.id)
            const burned_indexes = [] as number[]
            if (subcommand !== "last") {
                const card_args = card_ids.split(/\s+/)
                if (card_args.length == 0) {
                    Channel.replyNegative(message, "You must specify at least one card ID. (Example : /burn cards 1245)")
                    return
                }
                for (const arg of card_args) {
                    const card_id = parseInt(arg)
                    if (isNaN(card_id) || !Filters.isNumeric(arg)) {
                        await Channel.replyNegativeAsync(message, "You can only put card IDs as parameters, separated by spaces.\nExample : /burn cards 1234 5678.")
                        return
                    }
                    if (!inv.includes(card_id)) {
                        await Channel.replyNegativeAsync(message, "You can't burn a card that you don't own ! (ID : " + card_id + ")")
                        return
                    }
                    const i = inv.indexOf(card_id)
                    if (!burned_indexes.includes(i)) {
                        burned_indexes.push(i)
                    }
                }
                nb_burns = burned_indexes.length
            }
            if (nb_burns > 0) {
                self.burned_cards[user.id] = []
                for (let i = 0; i < nb_burns; i++) {
                    let idx = 0
                    if (subcommand == "last") {
                        idx = inv.length - (i + 1)
                    } else {
                        idx = burned_indexes[i]
                    }
                    if (idx == -1) {
                        Channel.replyNegative(message, "You don't own this card !")
                        return
                    } else if (idx < -1) {
                        Channel.replyNegative(message, "Sorry, I couldn't burn any more cards.")
                        return
                    }

                    const burn_id = inv[idx]
                    if (favs.includes(burn_id)) {
                        Channel.replyNegative(message, "You can't burn card n°" + burn_id + ", you marked it as fav !\nYou can use **/unfav** to remove it from your favorites.\n\n*If you were burning multiple cards, cards before this one was successfully burned.*")
                        return
                    } else {
                        const burned_card = gacha.getCardById(burn_id) as Card
                        if (!burned_card) {
                            return
                        }
                        if (burned_card.stars >= 3) {
                            await self.sendConfirmMessage(user, message, burned_card, nb_burns, favs, i, dataManager)
                        } else {
                            const [total_dust, total_gems] = await self.burnCard(user, message, burn_id, burned_card, dataManager)

                            if (total_dust > 0 || total_gems > 0) {
                                if (nb_burns == 1) {
                                    const dust_reward = Prices.getBurnPrices(burned_card)
                                    const gem_reward = self.getGemRewardFromBurn(user, burned_card)
                                    let content = "You earned **" + gem_reward + "** `💎` and **" + dust_reward + "** `🥜` by burning this card.\nYou now have **" + total_gems + "** `💎` and **" + total_dust + "** `🥜`.\n"

                                    const craft_prices = Prices.getCraftPrices()
                                    for (const price of craft_prices) {
                                        if (total_dust - dust_reward < price && total_dust >= price) {
                                            content += "\n**You now have enough to craft a " + (craft_prices.indexOf(price) + 1) + "-star card ! Use `craft card_id` to do so.**"
                                        }
                                    }

                                    self.sendBurnMessage(message, content, burned_card)
                                } else if (i == nb_burns - 1) {
                                    self.sendBurnAllMessage(message, self.burned_cards[user.id], favs)
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    async burnCard(user: User, message: Discord.ChatInputCommandInteraction, burn_id: number, burned_card: Card, dataManager: Database) {
        const upd_inv = await dataManager.getInventory(user.id) //Check again for exploits
        if (upd_inv.includes(burn_id)) {
            await dataManager.burnCard(user.id, burn_id)
            if (self.burned_cards[user.id]) {
                self.burned_cards[user.id].push(burned_card)
            }
            const dust_reward = Prices.getBurnPrices(burned_card)
            const total_dust = await dataManager.addNuts(user.id, dust_reward)
            const gem_reward = self.getGemRewardFromBurn(user, burned_card)
            const total_gems = await dataManager.addGems(user.id, gem_reward)
            return [total_dust, total_gems]
        }
        return [0, 0]
    },
    sendBurnMessage(message: Discord.ChatInputCommandInteraction, content: string, burned_card: Card) {
        const star = GUI.getStarFromType(burned_card.type)
        const msg = new Discord.EmbedBuilder()
            .setAuthor({ name: "Burning a card ...", iconURL: message.user.avatarURL() })
            .setColor("#ff3838")
            .setTitle("**`🔥` You burned `[" + star.repeat(burned_card.stars) + "]` " + burned_card.name + " !**")
            .setDescription(content)

        Channel.followUp(message, msg)
    },
    sendBurnAllMessage(message: Discord.ChatInputCommandInteraction, burned_cards: Card[], favs: number[]) {
        const all_burned_cards:string[] = []
        let desc = "",
            all_earned_dust = 0,
            all_earned_gems = 0

        if (!burned_cards || burned_cards.length == 0) {
            return
        }

        burned_cards.forEach(burned_card => {
            if (!favs.includes(burned_card.id)) {
                const star = GUI.getStarFromType(burned_card.type)

                if (burned_card.suffix != "") {
                    all_burned_cards.push("`[" + star.repeat(burned_card.stars) + "]` " + burned_card.name + " (Ver. " + burned_card.suffix + ")")
                } else {
                    all_burned_cards.push("`[" + star.repeat(burned_card.stars) + "]` " + burned_card.name)
                }
                all_earned_dust += Prices.getBurnPrices(burned_card)
                all_earned_gems += (burned_card.type != "group") ? 10 : 0
            }
        })
        for (const c of all_burned_cards) {
            if (desc.length < 2000) {
                desc += "**" + c + "**\n"
            }
        }
        if (desc.length >= 2000) {
            desc += " ... "
        }
        desc += "\nYou earned a total of **" + all_earned_gems + "** `💎` and **" + all_earned_dust + "** `🥜`."

        const msg = new Discord.EmbedBuilder()
            .setAuthor({ name: "Burning cards ...", iconURL: message.user.avatarURL() })
            .setColor("#ff3838")
            .setTitle("**`🔥` You burned " + burned_cards.length + " cards !**")


        if (desc.length > 0) {
            msg.setDescription(desc)
        }

        Channel.followUp(message, msg)
    },
    async sendConfirmMessage(user: User, message: Discord.ChatInputCommandInteraction, card: Card, nb_burns: number, favs: number[], index: number, dataManager: Database) {
        const star = GUI.getStarFromType(card.type)
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(user.id + "_burn_confirm_" + card.id)
                    .setEmoji("🔥")
                    .setStyle(ButtonStyle.Danger))

        const msg = new Discord.EmbedBuilder()
            .setAuthor({ name: "Burning cards ...", iconURL: message.user.avatarURL() })
            .setColor("#f39c12")
            .setTitle("**Are you sure you want to burn\n`[" + star.repeat(card.stars) + "]` " + card.name + " ?**")
            .setDescription("Click on the `🔥` button to burn, ignore to cancel.")

        const confirm_message = await message.followUp({ embeds: [msg], components: [row] }).catch(() => { });
        if (!confirm_message) {
            return
        }

        const filter = (i:any) => i.customId === user.id + "_burn_confirm_" + card.id && i.user.id === user.id;

        if (!message || !message.channel) {
            Channel.replyNegative(message, "I couldn't access the text channel for this interaction.\nPlease try again in another channel.")
            return
        }

        const collector = message.channel.createMessageComponentCollector({ filter, time: 5000 });

        collector.on('collect', async (i: Discord.ButtonInteraction) => {
            const dust_reward = Prices.getBurnPrices(card)
            const gem_reward = self.getGemRewardFromBurn(user, card)
            const content = "You earned **" + gem_reward + "** `💎` and **" + dust_reward + "** `🥜` by burning this card."
            const msg = new Discord.EmbedBuilder()
                .setAuthor({ name: "Burning a card ...", iconURL: message.user.avatarURL() })
                .setColor("#ff3838")
                .setTitle("**`🔥` You burned `[" + star.repeat(card.stars) + "]` " + card.name + " !**")
                .setDescription(content)

            await i.update({ components: [], embeds: [msg] }).catch(() => { });
            await self.burnCard(user, message, card.id, card, dataManager)
            if (index == nb_burns - 1 && nb_burns > 1) {
                self.sendBurnAllMessage(message, self.burned_cards[user.id], favs)
            }
            delete self.burned_cards[user.id]
        });

        collector.on('end', async collected => {
            if (collected.size == 0) {
                if (index == nb_burns - 1 && nb_burns > 1) {
                    self.sendBurnAllMessage(message, self.burned_cards[user.id], favs)
                }
                delete self.burned_cards[user.id]

                const msg = new Discord.EmbedBuilder()
                    .setAuthor({ name: "Burning cards ...", iconURL: message.user.avatarURL() })
                    .setColor("#f39c12")
                    .setDescription("You didn't burn **" + card.name + "**.")

                await (confirm_message as Message).edit({ embeds: [msg], components: [] }).catch(() => { });
            }
            collector.stop();
        });
    },
    async sendConfirmBurnAllMessage(user: User, message: Discord.ChatInputCommandInteraction, dataManager: Database, gacha: GachaManager) {
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(user.id + "_burn_all_confirm_")
                    .setEmoji("🔥")
                    .setStyle(ButtonStyle.Danger)
            )
        const msg = new Discord.EmbedBuilder()
            .setColor("#fff200")
            .setTitle("**Burn all cards (except favorites) ?**")
            .setDescription("You are going to burn all your **common & group** cards, except the ones you've marked as fav.\nIt will not burn event or other special cards.\nYou'll earn the same amount of `💎` and `🥜` for each card as a normal burn.\nThis doesn't count towards the burn quests.\nClick on the `🔥` button to accept and burn all those cards, ignore to cancel.")

        await message.editReply({ embeds: [msg], components: [row] }).catch(() => { });

        const filter = (i:any) => i.customId === user.id + "_burn_all_confirm_" && i.user.id === user.id;

        if (!message || !message.channel) {
            Channel.replyNegative(message, "I couldn't access the text channel for this interaction.\nPlease try again in another channel.")
            return
        }

        const collector = message.channel.createMessageComponentCollector({ filter, time: 5000 });

        collector.on('collect', async () => {
            if (user.gems > user.getGemsLimit()) {
                Channel.replyNegative(message, "Your current gem balance is above the max limit !\nYou can't use /burn all now, as you wouldn't be able to collect your gem rewards.")
                return
            }
            const inv = await dataManager.getInventory(user.id)
            const favs = await dataManager.getFavs(user.id)
            let burn_list = [] as number[],
                earned_dust = 0,
                earned_gems = 0
            for (const card_id of inv) {
                if (!favs.includes(card_id)) {
                    try {
                        const burned = gacha.getCardById(card_id) as Card
                        if (burned.stars && burned.is_mass_burnable()) {
                            if (burned.type !== "group") {
                                earned_dust += Prices.getBurnPrices(burned)
                                earned_gems += 10
                            }
                            burn_list.push(card_id)
                        }
                    } catch { }
                }
            }
            await dataManager.burnMultipleCards(user.id, burn_list)
            const total_dust = await dataManager.addNuts(user.id, earned_dust)
            if (user.gems + earned_gems > user.getGemsLimit()) {
                earned_gems = user.getGemsLimit() - user.gems
            }
            const total_gems = await dataManager.addGems(user.id, earned_gems)
            const msg = new Discord.EmbedBuilder()
                .setColor("#ff3838")
                .setTitle("**`🔥` You burned all your non-fav cards !**")
                .setDescription("You earned **" + earned_gems + "** `💎`and **" + earned_dust + "** `🥜`.\nYou now have **" + total_gems + "** `💎` and **" + total_dust + "** `🥜`.")
            Channel.followUp(message, msg)
        })

        collector.on('end', collected => {
            if (collected.size == 0) {
                const msg = new Discord.EmbedBuilder()
                    .setColor("#f39c12")
                    .setDescription("You didn't agree to burn all your non-fav cards.")

                Channel.followUp(message, msg)
            }
            collector.stop();
        });
    },
    getGemRewardFromBurn(user: User, card: Card) {
        return (user.gems < user.getGemsLimit() && !["group", "legendary", "group-legendary", "anniversary"].includes(card.type)) ? 10 : 0
    }
}