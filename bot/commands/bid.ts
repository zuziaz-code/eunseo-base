import { SlashCommandBuilder } from 'discord.js';
import Discord from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import moment from 'moment'
import { GachaManager } from '../gachamanager'
import { Database } from '../database'
import { Mutex, withTimeout } from 'async-mutex';
import { Card } from '../types/card';
import { Utils } from '../utils/utils';

module.exports = {
    locks: new Map(),
    data: new SlashCommandBuilder()
        .setName('bid')
        .setDescription('Bid on an auction')
        .addStringOption(option =>
            option.setName('auction_id')
                .setRequired(true)
                .setDescription('The ID of the auction you want to bid on'))
        .addNumberOption(option =>
            option.setName('price')
                .setRequired(true)
                .setDescription('The price in gems')),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager, client: Discord.Client) {
        const auction_id = message.options.getString('auction_id'),
            new_bid = message.options.getNumber('price')

        if (!Number.isInteger(new_bid)) {
            Channel.replyNegative(message, "You must enter only whole numbers."); return;
        }
        
        const auc = await dataManager.getAuction(auction_id)
        if (!auc) {
            Channel.replyNegative(message, "No auction exists with the ID.\nPerhaps you entered a Card ID instead of an Auction ID ? Find auction_ids with the **/auc** command to explore the auction market."); return;
        }
        if (!this.locks.has(auction_id)) {
            this.locks.set(auction_id, withTimeout(new Mutex(), 5000)) 

        }
        const trade_link = await dataManager.getTradeLink(user.id, auc.original_owner_id)
        if (trade_link && trade_link.count >= 3 && moment(trade_link.start_day).clone().add(1, "month").isAfter(moment())) {
            Channel.replyNegative(message, "You can't bid on this auction as you seem to know the seller !\nPlease note that auction manipulation is a bannable offence.\n\n*This message can also display if you accidentally bought multiple cards from the same seller.*"); return;
        }
        const m = this.locks.get(auction_id)

        if (m) {
            m.acquire().then(async (release:any) => {
                const inv = (await dataManager.getInventory(user.id)).map(x => gacha.getCardById(x)).filter(x => x !== null && x !== undefined).map(x => x.id)
                
                if (inv.includes(auc.card_id)) {
                    Channel.replyNegative(message, "You can't bid on a card you already own !");
                    return;
                }
                if (auc.original_owner_id == user.id) {
                    Channel.replyNegative(message, "You can't bid on your own card, you cheater.");
                    return;
                }
                if (auc.current_winner_id == user.id) {
                    Channel.replyNegative(message, "You can't bid on a card you're already winning !");
                    return;
                }
                if (auc.isFinished()) {
                    Channel.replyNegative(message, "This auction is finished, sorry !");
                    return;
                }
                if (!Number.isInteger(new_bid)) {
                    Channel.replyNegative(message, "Your bid must be a whole number.");
                    return;
                }
                if (new_bid > user.gems) {
                    Channel.replyNegative(message, "Sorry, you don't have enough `💎`.");
                    return;
                }
                if (!new_bid || new_bid == 0) {
                    release();
                    Channel.replyNegative(message, "I couldn't read your price.\nCommand usage : /bid auction_id price.");
                    return;
                }
                if (new_bid <= auc.price) {
                    release();
                    Channel.replyNegative(message, "Your bid must be higher than the current price !\nCurrent asking price is **" + auc.price + "** `💎`.");
                    return;
                }
                if (new_bid < auc.price + 50) {
                    release();
                    Channel.replyNegative(message, "Your bid must be at least 50 `💎` higher than the current price.\nCurrent asking price is **" + auc.price + "** `💎`.");
                    return;
                }
                if (new_bid / auc.price >= 3) {
                    release();
                    Channel.replyNegative(message, "Your bid is more than 3 times the current price !");
                    return;
                }

                const card = gacha.getCardById(auc.card_id) as Card

                if (card.stars == 1 && new_bid > 3000) {
                    release()
                    Channel.replyNegative(message, "You can't bid more than 3000 `💎` on a 1★ card.\nThis auction has been flagged as suspicious, please note that using auctions to transfer gems is strictly forbidden."); return;
                }

                const auc_recheck = await dataManager.getAuction(auction_id)
                if (auc.current_winner_id != auc_recheck.current_winner_id) {
                    release()
                    Channel.replyNegative(message, "Someone (or yourself ?) made a new bid on this auction, please try again.\nNew asking price is **" + auc_recheck.price + "** `💎`."); return;
                }

                await dataManager.addGems(user.id, -1 * new_bid)
                if (moment().isAfter(auc.end_time.clone().subtract('5', 'minute'))) {
                    await dataManager.addBidOnAuction(auc.auction_id, user.id, new_bid)
                    await dataManager.updateAuctionEnd(auc.auction_id, moment().add('5', 'minute'))
                    const msg = new Discord.EmbedBuilder()
                        .setAuthor({ name: "Bidding ...", iconURL: message.user.avatarURL() })
                        .setColor("#2ecc71")
                        .setDescription("I successfully registered your bid of **" + new_bid + "** `💎` on **" + card.name + "** (Auction ID: *" + auction_id + "*).\n*(Timer was reset to 5 minutes after your bid to be fair to other users.)*")
                    Channel.reply(message, msg)

                    const auc_recheck_2 = await dataManager.getAuction(auction_id)
                    if (user.id != auc_recheck_2.current_winner_id) {
                        await dataManager.addGems(user.id, new_bid)
                        release()
                        Channel.replyNegative(message, "Someone made a new bid before you on this auction, please try again.\nNew asking price is **" + auc_recheck.price + "** `💎`.\nYou got back your gems."); return;
                    }
                } else {
                    await dataManager.addBidOnAuction(auc.auction_id, user.id, new_bid)
                    const msg = new Discord.EmbedBuilder()
                        .setAuthor({ name: "Bidding ...", iconURL: message.user.avatarURL() })
                        .setColor("#2ecc71")
                        .setDescription("You successfully bid on **" + card.name + "** for **" + new_bid + "** `💎` (Auction ID: *" + auction_id + "*).\nAuction ends in **" + Utils.getTimeRemaining(auc.end_time) + "**. Good luck !")
                    Channel.reply(message, msg)

                    const auc_recheck_2 = await dataManager.getAuction(auction_id)
                    if (!auc_recheck_2) {
                        release()
                        Channel.replyNegative(message, "The auction was closed."); return;
                    }
                    if (user.id != auc_recheck_2.current_winner_id) {
                        await dataManager.addGems(user.id, new_bid)
                        release()
                        Channel.replyNegative(message, "Someone made a new bid before you on this auction, please try again.\nNew asking price is **" + auc_recheck.price + "** `💎`.\nYou got back your gems."); return;
                    }
                }

                if (auc.current_winner_id != null) {
                    await dataManager.addGems(auc.current_winner_id, auc.price)
                    void client.users.fetch(auc.current_winner_id).then(user => {
                        const msg = new Discord.EmbedBuilder()
                            .setColor("#f1c40f")
                            .setDescription("You were outbid by someone on **" + card.name + "** (Auc ID : " + auc.auction_id + "). Current asking price is **" + new_bid + "** `💎`.")

                        user.send({ embeds: [msg] }).catch(() => { })
                    })

                }

                release()
            }).catch((_err: Error) => {
                this.locks.delete(auction_id)
                Channel.replyNegative(message, "An error occured while trying to bid on this auction. Please try again.");
            })
        } else {
            Channel.replyNegative(message, "An error occured while trying to bid on this auction. Please try again."); return;
        }
    }
}