import { SlashCommandBuilder } from 'discord.js';
import Discord from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import moment from 'moment'
import { GachaManager } from '../gachamanager'
import { Database } from '../database'
import numeral from 'numeral'
import { Utils } from '../utils/utils';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Get your daily 💎'),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, _gacha: GachaManager) {
        const user_limit = user.getGemsLimit(),
            current_moment = moment()

        if (user.gems >= user_limit) {
            Channel.replyNegative(message, "You've reached your limit of " + Math.floor(user_limit / 100) + " gachas.\nPlease spend your gems !")
            return
        }

        const current_countdown = await dataManager.getCountdown(user.id, "timers_daily")
        if (!current_countdown || current_moment.isAfter(current_countdown)) {
            const end_countdown = current_moment.clone().add(20, "hours").format()
            await dataManager.replaceOrAddCountdown(user.id, "timers_daily", end_countdown)

            let reward = 800

            if (user.type != "") {
                reward = 1600
            }

            const total_gems = await dataManager.addGems(user.id, reward)
            const content = `You received **${reward} \`💎\`!**\nYou now have **${numeral(total_gems).format('0,0')}** \`💎\` and **${numeral(user.dust).format('0,0')}** \`🥜\`.\nYou can gacha **${Math.floor(total_gems / 100)}** times.`

            const msg = new Discord.EmbedBuilder()
                .setAuthor({ name: "Collecting daily rewards ...", iconURL: message.user.avatarURL() })
                .setColor("#3498db")
                .setDescription(content)
                .setFooter({ text: "See you in 20 hours !" })

            Channel.reply(message, msg)

            //Update username if different from global discord one
            const usr_name = message.user.username
            if (usr_name != user.name) {
                await dataManager.changeUsername(user.id, usr_name)
            }
        } else {
            Channel.replyPending(message, "You can get your daily rewards again in " + Utils.getTimeRemaining(moment(current_countdown)) + ".")
            return
        }
    }
}