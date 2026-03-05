import { SlashCommandBuilder } from 'discord.js';
import Discord, { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import { GachaManager } from '../gachamanager'
import { Database } from '../database'
import { Card } from '../types/card';
import { Prices } from '../prices'

const self = module.exports = {
    PRICES: Prices.getCraftPrices(),
    data: new SlashCommandBuilder()
        .setName('craft')
        .setDescription('Use your 🥜 to craft cards')
        .addNumberOption(option =>
            option.setName('card_id')
                .setRequired(true)
                .setDescription('The ID of the card to craft')),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager, _client: Discord.Client) {
        const desired_id = message.options.getNumber('card_id'),
            desired_card = gacha.getCardById(desired_id) as Card
        let has_crafted = false

        if (!desired_card) {
            Channel.replyNegative(message, 'No card exists by this ID !\nPlease use /search command to find the correct card ID.'); return;
        }
        if (desired_card.stars > 4) {
            Channel.replyNegative(message, 'You can\'t craft cards above 4 stars !'); return;
        }
        if (!desired_card.is_craftable()) {
            Channel.replyNegative(message, "You can only craft common cards. Event cards are only obtainable during events."); return;
        }
        let dust_price = self.PRICES[desired_card.stars - 1]
        if (user.dust < dust_price) {
            const msg = new Discord.EmbedBuilder()
                .setColor("#f1c40f")
                .setAuthor({ name: "Crafting a card ...", iconURL: message.user.avatarURL() })
                .setDescription('Crafting **' + desired_card.name + '** will cost you **' + dust_price + "** `🥜`.\n You don't have enough `🥜` to craft this card. (Your current `🥜` is `" + user.dust + "`).")

            Channel.reply(message, msg)
            return
        }

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(user.id + "_craft_" + desired_id)
                    .setEmoji("✅")
                    .setStyle(ButtonStyle.Success)
            )
        const msg = new Discord.EmbedBuilder()
            .setColor("#f1c40f")
            .setAuthor({ name: "Crafting a card ...", iconURL: message.user.avatarURL() })
            .setDescription('Crafting **' + desired_card.name + '** will cost you **' + dust_price + "** `🥜`.\nYou currently have **" + user.dust + "** `🥜`.\nClick on the `✅` button to accept and craft this card, ignore to cancel.")
        await message.editReply({ embeds: [msg], components: [row] }).catch(() => { })

        const filter = (i:any) => i.customId === user.id + "_craft_" + desired_id && i.user.id === user.id;

        const collector = message.channel.createMessageComponentCollector({ filter, time: 5000 });

        collector.on('collect', async (_i: Discord.ButtonInteraction) => {
            if (!has_crafted) {
                has_crafted = true

                const upd_user = await dataManager.getUser(user.id)
                if (upd_user.dust < dust_price) {
                    Channel.replyNegative(message, "You don't have enough `🥜` !"); return;
                } else {
                    const inv = (await dataManager.getInventory(user.id)).map(x => gacha.getCardById(x)).filter(x => x !== null && x !== undefined).map(x => x.id)
                    
                    if (inv.includes(desired_id)) {
                        Channel.replyNegative(message, "You already have this card !"); return;
                    }

                    const remaining_dust = await dataManager.removeNuts(user.id, dust_price)
                    await dataManager.addGacha(user.id, desired_id)
                    const reward = desired_card,
                        rarity = gacha.getRarityByStars(reward.stars)

                    const msg = new Discord.EmbedBuilder()
                        .setColor(rarity.color as Discord.ColorResolvable)
                        .setTitle("`" + reward.id + "` " + reward.name + " ```(" + reward.group.replace("*", "✭") + ")```")
                        .setAuthor({ name: `🎉 ${message.user.username}, you just crafted:`, iconURL: message.user.avatarURL() })
                        .addFields(
                            { name: `Rarity`, value: `:star:`.repeat(reward.stars), inline: true },
                            { name: `Cost`, value: "You spent **" + dust_price + "** `🥜` by crafting this card.\nYou have **" + remaining_dust + "** `🥜` remaining.", inline: false }
                        )
                        .setImage(reward.image)

                    Channel.reply(message, msg)
                }
            }
        });

        collector.on('end', collected => {
            if (collected.size == 0) {
                const msg = new Discord.EmbedBuilder()
                    .setColor("#e74c3c")
                    .setDescription("`❌` You didn't craft anything !")

                Channel.reply(message, msg)
            }
            collector.stop();
        });
    }
}