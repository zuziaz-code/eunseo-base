import { ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } from 'discord.js';
import Discord from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import { GachaManager } from '../gachamanager'
import { Database } from '../database'
import { Card } from '../types/card';
import { Filters } from '../utils/filters';
import { Prices } from '../prices';
import { Rarity } from '../rarity';
import { GUI } from '../core/gui';
import numeral from 'numeral'
import { Utils } from '../utils/utils';
import { Random } from '../utils/random';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('gacha')
        .setDescription('Spend 💎 to get kpop cards')
        .addNumberOption(option => option.setName('number').setDescription('Number of cards you want to gacha')),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
        const nb_draws = message.options.getNumber('number') || 1;
        if (!Number.isInteger(nb_draws)) {
            Channel.replyNegative(message, "You must enter only whole numbers.")
            return
        }
        if (nb_draws > 10) {
            Channel.replyNegative(message, "You can draw max. 10 cards per command use.")
            return
        }
        if (nb_draws < 1) {
            Channel.replyNegative(message, "You can draw min. 1 card per command use.")
            return
        }
        const nb_orbs = await dataManager.getGachaOrbs(user.id)

        const can_pay = (nb_orbs + Math.floor(user.gems / 100)) >= nb_draws
        if (!can_pay) {
            Channel.replyNegative(message, "You don't have enough gems to gacha !\nYou can use **/work** every 20 mns to get gems.")
            return
        }

        const inv = (await dataManager.getInventory(user.id)).map(x => gacha.getCardById(x)).filter(x => x !== null && x !== undefined).map(x => x.id)
        const wishlist = await dataManager.getWishlist(user.id)
        

        const embed = new Discord.EmbedBuilder()
            .setColor("#3498db")
            .setAuthor({ name: "Praying the gacha gods ...", iconURL: message.user.avatarURL() })
        Channel.reply(message, embed)

        const draws = [] as { "reward": Card, "is_double": boolean, "is_wishlisted": boolean }[]
        let total_dust = 0
        for (let i = 0; i < nb_draws; i++) {
            const reward = gacha.gacha()
            const draws_ids = draws.map(x => x["reward"].id)
            const is_double = inv.includes(reward.id) || draws_ids.includes(reward.id)
            const is_wishlisted = wishlist.includes(reward.id)
            draws.push({ "reward": reward, "is_double": is_double, "is_wishlisted": is_wishlisted })
        }

        draws.sort(Filters.compareStars)
        const gachas = [] as Card[]
        for (const tirage of draws) {
            const reward = tirage["reward"]
            if (!tirage["is_double"]) {
                gachas.push(reward)
            } else {
                total_dust += Prices.getBurnPrices(reward)
            }
        }

        await dataManager.addMultipleGachas(user.id, gachas.map(x => x.id))
        await dataManager.addNuts(user.id, total_dust)

        let used_orbs = nb_draws
        let gems_to_use = 0
        if (nb_orbs < nb_draws) {
            gems_to_use = (nb_draws - nb_orbs) * Prices.GACHA_PRICE
            used_orbs = nb_orbs
            await dataManager.removeGems(user.id, gems_to_use)
        }
        if (used_orbs > 0) {
            await dataManager.removeGachaOrbs(user.id, used_orbs)
        }
        if (used_orbs > 0 && used_orbs < 1) {
            console.log(user.id + " used " + used_orbs + " orbs !")
            return
        }

        const djsUser = message.user,
            top_tirage = draws[0],
            top_reward = top_tirage["reward"] as Card,
            top_rarity = gacha.getRarityByStars(top_reward.stars) as Rarity,
            dust_sentence = total_dust != 0 ? "You got **" + total_dust + "** `🥜` from your duplicates.\n" : ""

        let cost_txt = ""
        if (gems_to_use > 0 && used_orbs == 0) {
            cost_txt = "You spent **" + numeral(gems_to_use).format('0,0') + "** `💎`.\n" + dust_sentence + "You have **" + numeral(user.gems - gems_to_use).format('0,0') + "** `💎` remaining."
        } else if (gems_to_use == 0 && used_orbs > 0) {
            cost_txt = "You used **" + nb_draws + "** " + GUI.ORB_ICON + ".\nYou have **" + (nb_orbs - nb_draws) + "** " + GUI.ORB_ICON + " remaining.\n" + dust_sentence
        } else {
            cost_txt = "You used **" + used_orbs + "** " + GUI.ORB_ICON + " and **" + numeral(gems_to_use).format('0,0') + "** `💎`.\nYou have **" + (nb_orbs - used_orbs) + "** " + GUI.ORB_ICON + " remaining.\n" + dust_sentence + "You have **" + numeral(user.gems - gems_to_use).format('0,0') + "** `💎` remaining."
        }

        const msg = new Discord.EmbedBuilder()
            .setColor(gacha.getColorForCard(top_rarity, top_reward.type) as Discord.ColorResolvable)
            .setAuthor({ name: `You just got :`, iconURL: djsUser.avatarURL() })
            .setImage(top_reward.image)
            .addFields({ name: "Cost", value: cost_txt, inline: false })

        if (draws.length == 1) {
            const reward = top_reward,
                is_double = inv.includes(reward.id),
                star_type = GUI.getStarFromType(reward.type)

            let desc: string
            if (reward.suffix != "" && reward.suffix != "A") {
                desc = "Card ID : `" + reward.id + "` • **Alt. Version " + reward.suffix + "**"
            } else {
                desc = "Card ID : `" + reward.id + "`"
            }

            const title = "`[" + star_type.repeat(reward.stars) + "]` " + reward.name + " `(" + reward.group.replace("*", "✭") + ")`"
            msg.setTitle(title).setDescription(desc)

            if (is_double) {
                msg.addFields(
                    { name: "Duplicate", value: "You already have this card.\nYou got **" + total_dust + "** `🥜`.", inline: true },
                )
                msg.setFooter({ text: "🔥 You already had this card. It was burned automatically ! 🔥" })
            } else {
                const era_name = reward.era_name as string,
                    total_era_cards = Utils.get_all_main_cards(era_name, reward.type, reward.group, gacha).length

                let collection_content = "🖼️ **" + era_name + "** (**" + total_era_cards + "** cards)\n"

                msg.addFields(
                    { name: "Collection", value: collection_content, inline: false },
                )
            }
        } else {
            let desc = ""
            msg.setFooter({ text: top_reward.id + " - " + top_reward.name })

            for (const tirage of draws) {
                const reward = tirage["reward"],
                    star = GUI.getStarFromType(reward.type),
                    is_double = tirage["is_double"],
                    id_sentence = is_double ? "~~" + reward.id + "~~" : "`" + reward.id + "`"

                let add_content = id_sentence + " `[" + star.repeat(reward.stars) + "]`" + "  ".repeat(7 - reward.stars)

                if (is_double) {
                    add_content += "~~"
                }
                if (reward.suffix != "") {
                    add_content += "[" + reward.name + " (Ver. " + reward.suffix + ")](" + reward.image + ") `" + reward.group + "`"
                } else {
                    add_content += "[" + reward.name + "](" + reward.image + ") `" + reward.group + "`"
                }
                if (is_double) {
                    add_content += "~~"
                }
                if (tirage["is_wishlisted"]) {
                    add_content += " `💭` "
                }
                add_content += is_double ? " *(Duplicate)*\n" : "\n"

                if (desc.length + add_content.length >= 2048) {
                    desc += ".."
                } else {
                    desc += add_content
                }
            }
            const nb_draws_not_duplicates = draws.filter(tirage => !tirage["is_double"]).length
            desc += "You got **" + nb_draws_not_duplicates + "** new cards.\n"

            msg.setDescription(desc)
        }

        setTimeout(() => {
            if (draws.length === 1) {
                Channel.reply(message, msg)
            } else {
                const random_string = Random.getRandomFloat(0, 10).toString()
                const button1 = new ButtonBuilder()
                    .setCustomId('eunP' + random_string + user.id)
                    .setLabel('Previous')
                    .setStyle(ButtonStyle.Danger);

                const button2 = new ButtonBuilder()
                    .setCustomId('eunG' + random_string + user.id)
                    .setLabel('Next')
                    .setStyle(ButtonStyle.Success);

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents([button1, button2]);

                message.editReply({ embeds: [msg], components: [row] })
                    .then(() => {
                        try {
                            const filter = (i:any) => (i.customId === 'eunP' + random_string + user.id || i.customId === 'eunG' + random_string + user.id) && i.user.id === message.user.id;
                            const collector = message.channel.createMessageComponentCollector({ filter, time: 20000 });
                            let image_idx = 0
                            collector.on('collect', async (i: Discord.ButtonInteraction) => {
                                switch (i.customId) {
                                    case 'eunP' + random_string + user.id:
                                        image_idx = image_idx > 0 ? --image_idx : draws.length - 1;
                                        break;
                                    case 'eunG' + random_string + user.id:
                                        image_idx = image_idx + 1 < draws.length ? ++image_idx : 0;
                                        break;
                                    default:
                                        break;
                                }
                                await i.deferUpdate().catch(() => { })
                                const focused_card = draws[image_idx]["reward"] as Card
                                msg.setImage(focused_card.image)
                                    .setFooter({ text: focused_card.id + " - " + focused_card.name })
                                void message.editReply({ embeds: [msg], components: [row] }).catch(() => {
                                })
                                collector.resetTimer();
                            });

                            collector.on('end', () => {
                                const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
                                    button1.setDisabled(true),
                                    button2.setDisabled(true)
                                );
                                void message.editReply({ embeds: [msg], components: [disabledRow] }).catch(() => { })
                                collector.stop();
                            });
                        } catch { }
                    })
                    .catch(() => {
                        message.reply({ embeds: [msg], components: [] }).catch(() => {
                            message.user.send({ embeds: [msg], components: [] }).catch(() => { })
                        })
                    })
            }
        }, 1000)
    }
}