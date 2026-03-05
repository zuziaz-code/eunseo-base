import { SlashCommandBuilder } from 'discord.js';
import Discord, { ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import { GachaManager } from '../gachamanager'
import { Database } from '../database'
import { Card } from '../types/card';
import { Pages } from '../core/pages';
import { GUI } from '../core/gui';
import { Filters } from '../utils/filters';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inv')
        .setDescription('Display your cards or someone else\'s')
        .addStringOption(option => option.setName('query').setDescription('Filter by card names'))
        .addUserOption(option => option.setName('user').setDescription('View another user\'s cards'))
        .addStringOption(option => option.setName('group').setDescription('Filter by group'))
        .addStringOption(option => option.setName('era').setDescription('Filter by era'))
        .addStringOption(option => option.setName('idol').setDescription('Filter by idol'))
        .addNumberOption(option => option.setName('rarity').setDescription('Filter by number of stars').addChoices(
            { name: '1 star', value: 1 },
            { name: '2 stars', value: 2 },
            { name: '3 stars', value: 3 },
            { name: '4 stars', value: 4 },
            { name: '5 stars', value: 5 },
        ))
        .addBooleanOption(option => option.setName('fav').setDescription('Keep only favorite cards'))
        .addBooleanOption(option => option.setName('unfav').setDescription('Keep only non-favorite cards'))
        .addBooleanOption(option => option.setName('in_wishlist').setDescription('Keep only cards from your wishlist'))
        .addBooleanOption(option => option.setName('is_alt').setDescription('Include/exclude alt cards (Ver B/C)'))
        .addBooleanOption(option => option.setName('in_my_inv').setDescription('When viewing someone else\'s inventory, include/exclude cards in your inv'))
        .addStringOption(option => option.setName('type').setDescription('Search by card type').addChoices(
            { name: 'Group Legendary', value: 'group-legendary' },
            { name: 'Legendary', value: 'legendary' },
            { name: 'Event', value: 'event' },
            { name: 'Common', value: 'common' },
            { name: 'Group', value: 'group' },
        )),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
        const query = message.options.getString('query'),
            taggedUser = message.options.getUser('user'),
            group = message.options.getString('group'),
            era = message.options.getString('era'),
            idol = message.options.getString('idol'),
            rarity = message.options.getNumber('rarity'),
            fav = message.options.getBoolean('fav'),
            unfav = message.options.getBoolean('unfav'),
            type = message.options.getString('type'),
            in_wishlist = message.options.getBoolean('in_wishlist'),
            is_alt = message.options.getBoolean('is_alt'),
            inMyInv = message.options.getBoolean('in_my_inv')

        if (fav && unfav) {
            Channel.replyNegative(message, "You can't use both fav and unfav options at the same time !");
            return
        }
        if (rarity && rarity < 1 || rarity > 5) {
            Channel.replyNegative(message, "Rarity must be between 1 and 5 !");
            return
        }

        const target_user_id = taggedUser ? taggedUser.id : user.id;
        const target_inv = await dataManager.getInventory(target_user_id);
        const my_inv = target_user_id !== user.id ? await dataManager.getInventory(user.id) : [];
        const my_wishlist = target_user_id !== user.id ? await dataManager.getWishlist(user.id) : [];
        const fav_cards = await dataManager.getFavs(target_user_id);
        const target_user = await dataManager.getUser(target_user_id);

        const all_results = target_inv.map((el: number) => {
            return gacha.getCardById(el)
        }) as Card[]

        if (all_results.length == 0) {
            Channel.replyNegative(message, "Sorry, couldn't find any results.")
            return
        }

        //Filter stuff
        const filtered_results = []
        for (const reward of all_results) {
            if (!reward || !reward.id) {
                continue
            }
            if (fav && !fav_cards.includes(reward.id)) {
                continue
            }
            if (unfav && fav_cards.includes(reward.id)) {
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
            if (group && group !== "" && reward.group.toLowerCase() !== group.toLowerCase()) {
                continue
            }
            if (query && query !== "" && !reward.name.toLowerCase().includes(query.toLowerCase())) {
                continue
            }
            if (idol && idol !== "" && reward.idol_name.toLowerCase() !== idol.toLowerCase()) {
                continue
            }
            if (era && era !== "" && reward.era_name.toLowerCase() !== era.toLowerCase()) {
                continue
            }
            if (in_wishlist && !my_wishlist.includes(reward.id)) {
                continue
            }
            if (rarity && reward.stars !== rarity) {
                continue
            }
            if (type && reward.type !== type) {
                continue
            }
            if (inMyInv !== undefined && inMyInv !== null && target_user_id !== user.id) {
                if (inMyInv && !my_inv.includes(reward.id)) {
                    continue
                }
                if (!inMyInv && my_inv.includes(reward.id)) {
                    continue
                }
            }
            filtered_results.push(reward)
        }

        const nb_pages = Math.ceil(filtered_results.length / 7)

        if (nb_pages == 0) {
            Channel.replyNegative(message, "No cards in this inventory matched these filters.")
            return
        }

        //Sort by stars
        filtered_results.sort(Filters.compareStars)

        const all_pages: EmbedBuilder[] = []
        const filter_count = [query, group, era, idol, rarity, fav, unfav, type].filter(Boolean).length;
        let title: string,
            title_emote = "`🔎` "
        if (fav) {
            title_emote = "`💖` "
        } else if (unfav) {
            title_emote = "`💔` "
        }
        if (filter_count >= 2) {
            title = title_emote + target_user.name + "'s card collection (" + filter_count + " filters)"
        } else if (filter_count == 1) {
            title = title_emote + target_user.name + "'s card collection (" + filter_count + " filter)"
        } else {
            title = "`🖼️` " + target_user.name + "'s card collection"
        }

        for (let current_page = 1; current_page < nb_pages + 1; current_page++) {
            let content = "",
                idx = (current_page - 1) * 7,
                stop_adding = false,
                nb_added_elements = 0
            while (idx < filtered_results.length && !stop_adding && nb_added_elements < 7) {
                const reward = filtered_results[idx] as Card

                if (!reward) {
                    idx += 1
                    continue
                }

                const star = GUI.getStarFromType(reward.type)
                let add_content = ""
                try {
                    add_content = "`" + reward.id + " [" + star.repeat(reward.stars) + "]`" + "  ".repeat(7 -reward.stars)
                } catch { }

                if (reward.suffix !== "" && reward.type !== "legendary") {
                    add_content += "[" + reward.name + " (Ver. " + reward.suffix + ")](" + reward.image + ") `" + reward.group + "` "
                } else {
                    add_content += "[" + reward.name + "](" + reward.image + ") `" + reward.group + "` "
                }
                if (fav_cards.includes(reward.id)) {
                    add_content += "`💖` "
                }
                if (target_user_id !== user.id) {
                    if (my_inv.includes(reward.id)) {
                        add_content += "`🎒` "
                    } else if (my_wishlist.includes(reward.id)) {
                        add_content += "`💭` "
                    }
                }
                add_content += "\n"

                if (content.length + add_content.length >= 2048) {
                    stop_adding = true
                } else {
                    content += add_content
                }
                idx += 1
                nb_added_elements += 1
            }

            all_pages.push(new Discord.EmbedBuilder()
                .setColor("#4cd137")
                .setTitle(title)
                .setDescription(content))
        }

        const button1 = new ButtonBuilder()
            .setCustomId('eunPbtn' + user.id)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Danger);

        const button2 = new ButtonBuilder()
            .setCustomId('eunNbtn' + user.id)
            .setLabel('Next')
            .setStyle(ButtonStyle.Success);

        void Pages.paginateSlash(['eunPbtn' + user.id, 'eunNbtn' + user.id], message, all_pages, [button1, button2], 45000, message.user.id);
    }
}