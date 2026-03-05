import Discord, {SlashCommandBuilder} from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import { GachaManager } from '../gachamanager'
import { Database } from '../database'
import { Card } from '../types/card';
import { GUI } from '../core/gui';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unwish')
        .setDescription('Remove a card from your wishlist')
        .addStringOption(option => option.setName('card_ids').setDescription('List of card IDs to unfav (separated by spaces)').setRequired(true)),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
        const wishls = await dataManager.getWishlist(user.id),
            unwish_cards = [],
            card_ids = message.options.getString('card_ids'),
            card_args = card_ids.split(/\s+/)

        for (let arg of card_args) {
            const card_id = parseInt(arg)
            if (isNaN(card_id)) {
                Channel.replyNegative(message, "You can only put card IDs as parameters."); return;
            }
            if (!wishls.includes(card_id)) {
                Channel.replyNegative(message, "" + card_id + " is not in your wishlist."); return;
            }
            unwish_cards.push(card_id)
        }

        let desc = ""
        unwish_cards.forEach(card_id => {
            const card = gacha.getCardById(card_id) as Card
            const star = GUI.getStarFromType(card.type) as string
            void dataManager.removeWish(message.user.id, card_id)
            desc += "`[" + star.repeat(card.stars) + "]` **" + card.name + "**\n"
        })

        const title = unwish_cards.length == 1 ? "`💭✅` **You removed a card from your wishlist !**" : "`💭✅` **You removed " + unwish_cards.length + " cards from your wishlist !**"

        if (unwish_cards.length > 0) {
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