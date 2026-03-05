import Discord, { SlashCommandBuilder } from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import { GachaManager } from '../gachamanager'
import { Database } from '../database'
import { Card } from '../types/card';
import { GUI } from '../core/gui';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unfav')
        .setDescription('Remove a favorite card')
        .addStringOption(option => option.setName('card_ids').setDescription('List of card IDs to unfav (separated by spaces)').setRequired(true)),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
        const card_ids = message.options.getString('card_ids')

        const inv = await dataManager.getInventory(message.user.id)
        const favs = await dataManager.getFavs(user.id)
        const index_of_unfav_cards : number[] = []
        const card_args = card_ids.split(/\s+/)

        for (let arg of card_args) {
            const card_id = parseInt(arg)
            if (isNaN(card_id)) {
                Channel.replyNegative(message, "You can only put card IDs as parameters."); return;
            }
            if (!inv.includes(card_id)) {
                Channel.replyNegative(message, "You can't unfav a card if you don't own it ! (" + card_id + ")"); return;
            }
            if (!favs.includes(card_id)) {
                Channel.replyNegative(message, "You can't unfav a card if it's not in your favs ! (" + card_id + ")"); return;
            }
            const i = inv.indexOf(card_id)
            if (!index_of_unfav_cards.includes(i)) {
                index_of_unfav_cards.push(i)
            }
        }

        let unfav_cards = []
        let desc = ""
        for (let idx of index_of_unfav_cards) {
            const card = gacha.getCardById(inv[idx]) as Card
            if (!card) {
                Channel.replyNegative(message, "Sorry, the card you marked was invalid."); return;
            }
            unfav_cards.push(card)
            const star = GUI.getStarFromType(card.type) as string
            await dataManager.unfavCard(message.user.id, card.id)
            desc += "`[" + star.repeat(card.stars) + "]` **" + card.name + "**\n"
        }

        const title = unfav_cards.length == 1 ? "`💔` **You removed a card from your favs !**" : "`💔` **You removed " + unfav_cards.length + " cards from your favorites !**"

        if (unfav_cards.length > 0) {
            const msg = new Discord.EmbedBuilder()
                .setAuthor({ name: "Removing cards ...", iconURL: message.user.avatarURL() })
                .setColor("#2ecc71")
                .setTitle(title)

            if (desc.length < 2048) {
                msg.setDescription(desc)
            }

            Channel.reply(message, msg)
        }
    }
}