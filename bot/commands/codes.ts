import Discord, { SlashCommandBuilder } from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import { GachaManager } from '../gachamanager'
import { Database } from '../database'
import { Card } from '../types/card';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('codes')
        .setDescription('Get a list of card codes (for burning, fav, trading...)')
        .addBooleanOption(option => option.setName('in_my_inv').setDescription('View only cards in your inventory'))
        .addStringOption(option => option.setName('group').setDescription('Name of a group to get card codes for'))
        .addStringOption(option => option.setName('idol').setDescription('Name of an idol to get card codes for'))
        .addStringOption(option => option.setName('type').setDescription('Filter by type of cards').addChoices(
            { name: 'Group Legendary', value: 'group-legendary' },
            { name: 'Legendary', value: 'legendary' },
            { name: 'Event', value: 'event' },
            { name: 'Common', value: 'common' },
            { name: 'Group', value: 'group' },
        ))
        .addNumberOption(option => option.setName('rarity').setDescription('Filter by number of stars').addChoices(
            { name: '1 star', value: 1 },
            { name: '2 stars', value: 2 },
            { name: '3 stars', value: 3 },
            { name: '4 stars', value: 4 },
            { name: '5 stars', value: 5 },
        ))
        .addBooleanOption(option => option.setName('is_alt').setDescription('Include/exclude alt cards (Ver B/C)'))
        .addStringOption(option => option.setName('exclude_idols').setDescription('Exclude idol(s) from the results (split by comma without a space)'))
        .addStringOption(option => option.setName('exclude_era').setDescription('Exclude an era from the results (case-sensitive)')),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
        const in_my_inv = message.options.getBoolean('in_my_inv'),
            group_name = message.options.getString('group'),
            idol_name = message.options.getString('idol'),
            type = message.options.getString('type'),
            exclude_era_name = message.options.getString('exclude_era'),
            exclude_idol_name = message.options.getString('exclude_idols'),
            rarity = message.options.getNumber('rarity'),
            is_alt = message.options.getBoolean('is_alt');

        let exclude_idols: string[] = [];
        if (exclude_idol_name) {
            exclude_idols = exclude_idol_name.split(',');
        }
        if (rarity && rarity < 1 || rarity > 5) {
            Channel.replyNegative(message, "Rarity must be between 1 and 5 !");
            return
        }

        const all_results = gacha.getAllCards()
        const inv = await dataManager.getInventory(user.id)

        //Filter stuff
        const filtered_results = [] as Card[]
        for (const reward of all_results) {
            if (!reward || !reward.id) {
                continue
            }
            if (group_name && reward.group.toLowerCase() != group_name.toLowerCase()) {
                continue
            }
            if (idol_name && reward.idol_name.toLowerCase() != idol_name.toLowerCase()) {
                continue
            }
            if (exclude_idol_name && exclude_idols.includes(reward.idol_name.toLowerCase())) {
                continue
            }
            if (exclude_era_name && reward.era_name == exclude_era_name) {
                continue
            }
            if (type && type != "" && reward.type.toLowerCase() != type.toLowerCase()) {
                continue
            }
            if (is_alt !== undefined && is_alt !== null) {
                if (is_alt && !reward.is_alt()) {
                    continue
                }
                if (!is_alt && reward.is_alt()) {
                    continue
                }
            }
            if (rarity && reward.stars != rarity) {
                continue
            }
            if (in_my_inv !== undefined && in_my_inv !== null) {
                if (in_my_inv && !inv.includes(reward.id)) {
                    continue
                }
                if (!in_my_inv && inv.includes(reward.id)) {
                    continue
                }
            }
            filtered_results.push(reward)
        }

        if (filtered_results.length == 0) {
            Channel.replyNegative(message, "Sorry, couldn't find any results for this query.")
            return
        }
        filtered_results.sort((a, b) => {
            return a.id - b.id
        })

        let code_list = ""
        for (const reward of filtered_results) {
            code_list += reward.id + " "
        }

        if (code_list.length > 2000) {
            if (in_my_inv === undefined || in_my_inv === null) {
                Channel.replyNegative(message, "Sorry, the list of codes is too long to be displayed.\nUse filters to narrow down your search.")
            } else {
                Channel.replyNegative(message, "Sorry, the list of codes is too long to be displayed.\nUse filters to narrow down your search.\n\nNote that the default command searches in the entire bot database, use only_my_inv:true to search only in your inventory.")
            }
            return
        }

        const content = code_list
        await message.editReply({ content: content }).catch(() => {
            message.user.send({ content: content }).catch(() => { })
        })
    }
}