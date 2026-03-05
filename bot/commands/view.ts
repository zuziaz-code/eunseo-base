import { SlashCommandBuilder } from 'discord.js';
import Discord from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import { GachaManager } from '../gachamanager'
import { Database } from '../database'
import { Card } from '../types/card';
import { Utils } from '../utils/utils';
import { GUI } from '../core/gui';
import { Rarity } from '../rarity';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('view')
        .setDescription('View a card by its ID')
        .addNumberOption(option => option.setName('card_id').setRequired(true).setDescription('ID of the card you want to view')),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
        const card_id = message.options.getNumber('card_id'),
            reward = gacha.getCardById(card_id) as Card

        if (!reward) {
            Channel.replyNegative(message, "No card exists by this ID.\nUse **/search** to find the correct ID.")
            return
        }

        const favs = await dataManager.getFavs(user.id)
        const stars = reward.stars,
            rarity = gacha.getRarityByStars(stars) as Rarity,
            star_type = GUI.getStarFromType(reward.type),
            title = favs.includes(reward.id) ? "`💖` " + reward.name : reward.name

        let card_info = ""
        if (reward.is_auctionable()) {
            card_info += "This card can be sold at auctions.\n"
        } else {
            card_info += "This card cannot be sold at auctions.\n"
        }
        if (reward.is_tradeable()) {
            card_info += "This card can be traded.\n"
        } else {
            card_info += "This card cannot be traded.\n"
        }

        const msg = new Discord.EmbedBuilder()
            .setColor(gacha.getColorForCard(rarity, reward.type) as Discord.ColorResolvable)
            .setTitle(title)
            .setAuthor({ name: "Viewing card n°" + card_id + "...", iconURL: message.user.avatarURL() })
            .addFields(
                { name: "Group", value: "`" + reward.group.replace("*", "✭") + "`", inline: true },
                { name: "Card Type", value: "`" + Utils.capitalize(reward.type) + "`", inline: true },
                { name: "Rarity", value: "`" + star_type.repeat(stars) + "`", inline: true },
                { name: "Card Info", value: card_info, inline: false },
            )

        if (reward.type == "legendary" || reward.type == "group-legendary") {
            Channel.replyWithAttach(message, msg, reward.image)
        } else {
            msg.setImage(reward.image)
            Channel.reply(message, msg)
        }
    }
}