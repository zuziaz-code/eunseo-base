import Discord, { SlashCommandBuilder, time, TimestampStyles } from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import { Database } from '../database'
import moment from 'moment';


module.exports = {
    data: new SlashCommandBuilder()
        .setName('cds')
        .setDescription('View all your countdowns'),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database) {
        const current_moment = moment()
        let msg_content = ""

        const work_cd = await dataManager.getCountdown(user.id, "timers_work"),
            daily_cd = await dataManager.getCountdown(user.id, "timers_daily")

        if (!work_cd || current_moment.isAfter(work_cd)) {
            msg_content += "**`💼`  Work** : `✅`"
        } else {
            msg_content += "**`💼`  Work** : " + time(moment(work_cd).unix(), TimestampStyles.RelativeTime)
        }
        msg_content += "\n"

        if (!daily_cd || current_moment.isAfter(daily_cd)) {
            msg_content += "**`📆`  Daily** : `✅`"
        } else {
            msg_content += "**`📆`  Daily** : " + time(moment(daily_cd).unix(), TimestampStyles.RelativeTime)
        }
        msg_content += "\n"

        msg_content += "\n"

        const msg = new Discord.EmbedBuilder()
            .setAuthor({ name: "Checking " + user.name + "'s timers ...", iconURL: message.user.avatarURL() })
            .setColor("#47c2f7")
            .setDescription(msg_content)

        Channel.reply(message, msg)
    }
}