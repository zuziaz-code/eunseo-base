import { SlashCommandBuilder } from 'discord.js';
import Discord, { ButtonStyle } from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import { GachaManager } from '../gachamanager'
import { Database, DbQuery } from '../database'
import { AuctionCard } from '../types/auctioncard';
import { GUI } from '../core/gui'
import { Utils } from '../utils/utils'
import { Pages } from '../core/pages'
import { Filters } from '../utils/filters';
import numeral from 'numeral'


module.exports = {
    data: new SlashCommandBuilder()
        .setName('auctions')
        .setDescription('See cards on auction market')
        .addStringOption(option => option.setName('query').setDescription('Filter by card names'))
        .addStringOption(option => option.setName('idol').setDescription('Search by idol'))
        .addStringOption(option => option.setName('group').setDescription('Search by group'))
        .addStringOption(option => option.setName('type').setDescription('Search by card type').addChoices(
            { name: 'Event', value: 'event' },
            { name: 'Common', value: 'common' },
        ))
        .addNumberOption(option => option.setName('rarity').setDescription('Filter by number of stars').addChoices(
            { name: '1 star', value: 1 },
            { name: '2 stars', value: 2 },
            { name: '3 stars', value: 3 },
            { name: '4 stars', value: 4 },
        ))
        .addBooleanOption(option => option.setName('in_wishlist').setDescription('View auctions for cards in your wishlist'))
        .addBooleanOption(option => option.setName('in_my_inv').setDescription('View auctions for cards in your inv or not'))
        .addBooleanOption(option => option.setName('me').setDescription('View only the auctions you sell and bid on'))
        .addBooleanOption(option => option.setName('no_bids').setDescription('View only the auctions with no bids'))
    ,
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
        const options = message.options,
            query = options.getString('query'),
            me = options.getBoolean('me'),
            idol = options.getString('idol'),
            group = options.getString('group'),
            wishls_filter = options.getBoolean('in_wishlist'),
            type = options.getString('type'),
            rarity = message.options.getNumber('rarity'),
            no_bids = options.getBoolean('no_bids'),
            in_my_inv = options.getBoolean('in_my_inv')

        Channel.replyPending(message, "Loading auctions...")
        
        const inv = await dataManager.getInventory(user.id),
            wishlist = await dataManager.getWishlist(user.id)
        let db_query: DbQuery = {}
        if (me) {
            db_query = {
                $or: [
                    {
                        "original_owner_id": user.id
                    },
                    {
                        "current_winner_id": user.id
                    }
                ]
            }
        }
        if (wishls_filter) {
            db_query["card_id"] = { $in: wishlist }
        }
        if (no_bids) {
            db_query["current_winner_id"] = null
        }

        const all_auctions = await dataManager.getAllAuctions(db_query)
        const auctions = [] as AuctionCard[]

        for (const auc of all_auctions) {
            if (!auc.isFinished()) {
                if (wishls_filter && inv.includes(auc.card_id)) {
                    continue
                }
                if (in_my_inv && !inv.includes(auc.card_id)) {
                    continue
                }
                if (in_my_inv === false && inv.includes(auc.card_id)) {
                    continue
                }

                const rew = gacha.getCardById(auc.card_id),
                    auc_reward = new AuctionCard(auc, rew)
                if (!rew || !rew.id) {
                    continue
                }
                if (group && group != "" && rew.group.toLowerCase() != group.toLowerCase()) {
                    continue
                }
                if (query && query != "" && !rew.name.toLowerCase().includes(query.toLowerCase())) {
                    continue
                }
                if (idol && idol != "" && rew.idol_name.toLowerCase() != idol.toLowerCase()) {
                    continue
                }
                if (type && type != "" && rew.type.toLowerCase() != type.toLowerCase()) {
                    continue
                }
                if (rarity && rew.stars != rarity) {
                    continue
                }

                auctions.push(auc_reward)
            }
        }

        if (auctions.length == 0) {
            if (me) {
                Channel.replyNegative(message, "You have no auctions currently underway matching these filters."); return;
            }
            Channel.replyNegative(message, "No auctions are currently underway for these filters."); return;
        }

        const nb_pages = Math.ceil(auctions.length / 7)
        auctions.sort(Filters.compareTime)
        const filter_count = [query, group, idol, type, me, wishls_filter].filter(Boolean).length;

        let title: string,
            title_emote = "`🔎` "
        if (filter_count >= 2) {
            title = title_emote + "Listing " + auctions.length + " auctions matching " + filter_count + " filters"
        } else if (filter_count == 1) {
            if (wishls_filter) {
                title = "`🔎` Listing all auctions in your wishlist"
            } else if (me) {
                title = "`🔎` Listing all the cards you sell or have a bid on"
            } else if (no_bids) {
                title = "`🔎` Listing all the cards with no bids"
            } else {
                title = title_emote + "Listing " + auctions.length + " auctions matching " + filter_count + " filter"
            }
        } else {
            title = "`🔎` Listing all " + auctions.length + " cards currently sold"
        }

        const pages = []
        for (let current_page = 1; current_page < nb_pages + 1; current_page++) {
            let idx = (current_page - 1) * 7,
                content = "",
                stop_adding = false
            while (idx < auctions.length && !stop_adding && idx < current_page * 7) {
                const reward = auctions[idx],
                    star = GUI.getStarFromType(reward.rew.type)
                let add_content = ""

                add_content += "`" + reward.auction.auction_id + " [" + star.repeat(reward.rew.stars) + "]"
                if (reward.auction.current_winner_id == user.id) {
                    add_content += "✅` "
                } else if (reward.auction.original_owner_id == user.id) {
                    add_content += "🔷` "
                } else if (inv.includes(reward.rew.id)) {
                    add_content += "🎒` "
                } else if (wishlist.includes(reward.rew.id)) {
                    add_content += "💭` "
                } else {
                    add_content += "` "
                }

                if (reward.rew.suffix != "" && reward.rew.type != "legendary") {
                    add_content += "[" + reward.rew.name + " **(Ver. " + reward.rew.suffix + ")**](" + reward.rew.image + ") `" + reward.rew.group.replace("*", "✭") + "`"
                } else {
                    add_content += "[" + reward.rew.name + "](" + reward.rew.image + ") `" + reward.rew.group.replace("*", "✭") + "`"
                }
                const time_remaining = Utils.getTimeRemaining(reward.auction.end_time)

                add_content += " | **" + numeral(reward.auction.price).format('0,0') + "** `💎` | " + time_remaining + "\n"

                if (content.length + add_content.length >= 2048) {
                    stop_adding = true
                } else {
                    content += add_content
                }
                idx += 1
            }

            pages.push(new Discord.EmbedBuilder()
                .setColor("#f368e0")
                .setTitle(title)
                .setDescription(content))
        }

        const button1 = new Discord.ButtonBuilder()
            .setCustomId('eunPbtn' + user.id)
            .setLabel('Previous')
            .setStyle(ButtonStyle.Danger);

        const button2 = new Discord.ButtonBuilder()
            .setCustomId('eunNbtn' + user.id)
            .setLabel('Next')
            .setStyle(ButtonStyle.Success);

        void Pages.paginateSlash(['eunPbtn' + user.id, 'eunNbtn' + user.id], message, pages, [button1, button2], 45000, user.id);
    }
}