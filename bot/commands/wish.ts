import { SlashCommandBuilder } from 'discord.js';
import Discord, { ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import { GachaManager } from '../gachamanager'
import { Database } from '../database'
import { Card } from '../types/card';
import { GUI } from '../core/gui';
import { Filters } from '../utils/filters';
import { Pages } from '../core/pages';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('wish')
        .setDescription('See & add cards to your wishlist')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add cards to your wishlist')
                .addStringOption(option => option.setName('card_ids').setDescription('List of card IDs to add (separated by spaces)').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('View your or someone else\'s wishlist')
                .addUserOption(option => option.setName('user').setDescription('User to view wishlist of'))
                .addStringOption(option => option.setName('query').setDescription('Filter by card names'))
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
                .addBooleanOption(option => option.setName('in_my_inv').setDescription('When viewing someone else\'s wishlist, include/exclude cards in your inv'))
                .addBooleanOption(option => option.setName('is_alt').setDescription('Include/exclude alt cards (Ver B/C)'))
                .addBooleanOption(option => option.setName('in_my_unfav').setDescription('Include/exclude cards not in your favorites'))
                .addStringOption(option => option.setName('type').setDescription('Filter by card type').addChoices(
                    { name: 'Group Legendary', value: 'group-legendary' },
                    { name: 'Legendary', value: 'legendary' },
                    { name: 'Event', value: 'event' },
                    { name: 'Common', value: 'common' },
                    { name: 'Group', value: 'group' },
                ))),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
        const subcommand = message.options.getSubcommand(),
            taggedUser = message.options.getUser('user'),
            query = message.options.getString('query'),
            group = message.options.getString('group'),
            era = message.options.getString('era'),
            idol = message.options.getString('idol'),
            rarity = message.options.getNumber('rarity'),
            type = message.options.getString('type'),
            card_ids = message.options.getString('card_ids'),
            inMyInv = message.options.getBoolean('in_my_inv'),
            isAlt = message.options.getBoolean('is_alt'),
            inMyUnfav = message.options.getBoolean('in_my_unfav')

        const wishlist = await dataManager.getWishlist(message.user.id)
        const inv = await dataManager.getInventory(user.id)
        if (subcommand == "add") { //Add cards to your wishlist
            try {
                let wished_cards = []
                const card_args = card_ids.split(/\s+/)
                if (card_args.length == 0) {
                    Channel.replyNegative(message, "You must specify at least one card ID. (Example : /wish add 1245)"); return;
                }

                const already_owned = []
                const already_wished = []
                for (let arg of card_args) {
                    let card_id = parseInt(arg)
                    if (isNaN(card_id) || !Filters.isNumeric(arg)) {
                        Channel.replyNegative(message, "You can only put card IDs as parameters. (Example : /wish add 1245)"); return;
                    }
                    if (wishlist.includes(card_id)) {
                        already_wished.push(card_id)
                        continue
                    }
                    if (inv.includes(card_id)) {
                        already_owned.push(card_id)
                        continue
                    }
                    wished_cards.push(card_id)
                }

                if (wished_cards.length == 0) {
                    Channel.replyNegative(message, "You already own or wish for all the cards you specified."); return;
                }

                let fav_cards = []
                let desc = ""
                for (let idx of wished_cards) {
                    const card = gacha.getCardById(idx) as Card
                    if (!card) {
                        Channel.replyNegative(message, "The card you marked was invalid (" + idx + ")."); return;
                    }
                    fav_cards.push(card)
                    const star = GUI.getStarFromType(card.type) as string
                    await dataManager.addWish(message.user.id, card.id)
                    if (card.suffix != "" && card.type != "legendary") {
                        desc += "`[" + star.repeat(card.stars) + "]` **" + card.name + "** (Ver. " + card.suffix + ")\n"
                    } else {
                        desc += "`[" + star.repeat(card.stars) + "]` **" + card.name + "**\n"
                    }

                }

                let title = fav_cards.length == 1 ? "`💭` **You added a card to your wishlist !**" : "`💭` **You added " + fav_cards.length + " cards to your wishlist !**"

                if (fav_cards.length > 0) {
                    const msg = new Discord.EmbedBuilder()
                        .setAuthor({ name: "Wishing for cards ...", iconURL: message.user.avatarURL() })
                        .setColor("#2ecc71")
                        .setTitle(title)

                    if (already_owned.length > 0) {
                        desc += "\n+ `🎒` " + already_owned.length + " cards already owned"
                    }
                    if (already_wished.length > 0) {
                        desc += "\n+ `💕` " + already_wished.length + " cards already wished"
                    }

                    if (desc.length < 2048) {
                        msg.setDescription(desc)
                    }

                    Channel.reply(message, msg)
                }
            } catch (err) {
                console.log(err)
            }
        }
        else { // Voir une wishlist
            try {
                let target_user_id = taggedUser ? taggedUser.id : user.id

                const target_user = await dataManager.getUser(target_user_id)
                const wishlist = await dataManager.getWishlist(target_user_id)
                const target_inv = await dataManager.getInventory(target_user_id)
                const my_inv = await dataManager.getInventory(user.id)
                const my_favs = await dataManager.getFavs(user.id)
                const all_results = wishlist.map((el: number) => {
                    return gacha.getCardById(el)
                }) as Card[]

                if (all_results.length == 0) {
                    Channel.replyNegative(message, "Sorry, this user doesn't seem to have a wishlist yet."); return;
                }

                //Filter stuff
                const filtered_results = [] as Card[]
                for (const reward of all_results) {
                    if (!reward || !reward.id) {
                        continue
                    }
                    if (group && group != "" && reward.group.toLowerCase() != group.toLowerCase()) {
                        continue
                    }
                    if (query && query != "" && !reward.name.toLowerCase().includes(query.toLowerCase())) {
                        continue
                    }
                    if (idol && idol != "" && reward.idol_name.toLowerCase() != idol.toLowerCase()) {
                        continue
                    }
                    if (era && era != "" && reward.era_name.toLowerCase() != era.toLowerCase()) {
                        continue
                    }
                    if (type && type != "" && reward.type.toLowerCase() != type.toLowerCase()) {
                        continue
                    }
                    if (rarity && reward.stars != rarity) {
                        continue
                    }
                    if (inMyInv !== undefined && inMyInv !== null) {
                        if (inMyInv && !inv.includes(reward.id)) {
                            continue
                        }
                        if (!inMyInv && inv.includes(reward.id)) {
                            continue
                        }
                    }
                    if (isAlt !== undefined && isAlt !== null) {
                        if (isAlt && !reward.is_alt()) {
                            continue
                        }
                        if (!isAlt && reward.is_alt()) {
                            continue
                        }
                    }
                    if (inMyUnfav !== undefined && inMyUnfav !== null) {
                        if (inMyUnfav && my_favs.includes(reward.id)) {
                            continue
                        }
                        if (!inMyUnfav && !my_favs.includes(reward.id)) {
                            continue
                        }
                    }

                    filtered_results.push(reward)
                }

                const nb_pages = Math.ceil(filtered_results.length / 7)

                if (nb_pages == 0) {
                    Channel.replyNegative(message, "Sorry, I couldn't find any results matching your filters in this wishlist !"); return;
                }

                //Sort by stars
                const sorted_filtered_results = filtered_results.sort((a: Card, b: Card) => {
                    const diff = b.stars - a.stars
                    if (diff != 0)
                        return diff
                    if (a.type != "common" && b.type == "common")
                        return -1
                    if (a.type == "common" && b.type != "common")
                        return 1
                    return a.name.localeCompare(b.name)
                })

                const all_pages: EmbedBuilder[] = []
                let title = ""
                const filter_count = [query, group, era, idol, type, rarity].filter(Boolean).length;
                if (filter_count >= 2) {
                    title = "`💭🔎` " + target_user.name + "'s wishes matching " + filter_count + " filters"
                } else if (filter_count == 1) {
                    title = "`💭🔎` " + target_user.name + "'s wishes matching " + filter_count + " filter"
                } else {
                    title = "`💭` " + target_user.name + "'s wishlist"
                }

                for (let current_page = 1; current_page < nb_pages + 1; current_page++) {
                    let content = "",
                        idx = (current_page - 1) * 7,
                        stop_adding = false,
                        nb_added_elements = 0
                    while (idx < sorted_filtered_results.length && !stop_adding && nb_added_elements < 7) {
                        const reward = sorted_filtered_results[idx] as Card

                        if (!reward) {
                            idx += 1
                            continue
                        }
                        if (target_user_id == message.user.id && target_inv.includes(reward.id)) {
                            await dataManager.removeWish(message.user.id, reward.id)
                            idx += 1
                            continue
                        }

                        let star = GUI.getStarFromType(reward.type),
                            add_content = ""
                        try {
                            add_content = "`" + reward.id + " [" + star.repeat(reward.stars) + "]`" + "  ".repeat(7 -reward.stars)
                        } catch { }

                        if (reward.suffix != "" && reward.type != "legendary") {
                            add_content += "[" + reward.name + " (Ver. " + reward.suffix + ")](" + reward.image + ") `" + reward.group + "` "
                        } else {
                            add_content += "[" + reward.name + "](" + reward.image + ") `" + reward.group + "` "
                        }
                        if (target_user_id != message.user.id && my_inv.includes(reward.id)) {
                            add_content += "`🎒` "
                        }
                        add_content += "\n"

                        if (content.length + add_content.length >= 2000) {
                            stop_adding = true
                        } else {
                            content += add_content
                        }
                        idx += 1
                        nb_added_elements += 1
                    }

                    if (content == "") {
                        Channel.replyNegative(message, "Sorry, I couldn't find any results matching your filters in this wishlist !"); return;
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
            } catch (err) {
                console.log(err)
            }
        }
    }
}