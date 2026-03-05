import { SlashCommandBuilder } from 'discord.js';
import Discord from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import moment from 'moment'
import { Database } from '../database'
import { Utils } from '../utils/utils';
import numeral from 'numeral';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Get 100 💎 every 20 mns'),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database) {
        const current_moment = moment(),
            user_limit = user.getGemsLimit()
        if (user.gems >= user_limit) {
            Channel.replyNegative(message, "You've reached your limit of " + Math.floor(user_limit / 100) + " gachas.\nPlease spend your gems !")
            return
        }

        const current_countdown = await dataManager.getCountdown(user.id, "timers_work")
        if (!current_countdown || current_moment.isAfter(current_countdown)) {
            const end_countdown = current_moment.clone().add(20, "minutes").format()
            await dataManager.replaceOrAddCountdown(user.id, "timers_work", end_countdown)

            const reward = 100

            const total_gems = await dataManager.addGems(user.id, reward)
            const msg = new Discord.EmbedBuilder()
                .setColor("#47c2f7")
                .setAuthor({ name: "Working ...", iconURL: message.user.avatarURL() })
                .setDescription("**You received " + reward + " `💎` !**\nYou have **" + numeral(total_gems).format('0,0') + "** `💎`.\nYou can gacha **" + Math.floor(total_gems / 100) + "** times.")
                .setFooter({ text: "See you in 20 minutes !" })

            Channel.reply(message, msg)
        } else {
            Channel.replyPending(message, "You can work again in " + Utils.getTimeRemaining(moment(current_countdown)) + ".")
            return
        }
    }
}