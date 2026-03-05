import Discord, { SlashCommandBuilder } from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import { Database } from '../database'
import {GUI} from '../core/gui'
import numeral from 'numeral'

module.exports = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check your 💎 and 🥜')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Check the balance of a user')),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database) {
        let discordjsUser = message.user,
            taggedUser = message.options.getUser('user')

        if (!taggedUser) {
            taggedUser = discordjsUser
        }

        const target_user = await dataManager.getUser(taggedUser.id)
        if (!target_user) {
            Channel.replyNegative(message, "I couldn't find that user."); return;
        }
        const nb_orbs = await dataManager.getGachaOrbs(target_user.id)

        const msg = new Discord.EmbedBuilder()
            .setColor("#4834d4")
            .setAuthor({ name: "💴 " + target_user.name + "'s currencies", iconURL: taggedUser.avatarURL() })
            .setDescription("\n**Gems** : **" + numeral(target_user.gems).format('0,0') + "** `💎`\n**Peanuts** : **" + numeral(target_user.dust).format('0,0') + "** `🥜`\n**Gacha Orbs : " + nb_orbs + " " + GUI.ORB_ICON + "**\n\nThis user can gacha a total of **" + (Math.floor(target_user.gems / 100) + nb_orbs) + " ** times.")

        Channel.reply(message, msg)
    }
}