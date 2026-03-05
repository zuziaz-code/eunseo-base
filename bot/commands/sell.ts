import { SlashCommandBuilder } from 'discord.js';
import Discord, { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import moment from 'moment'
import { GachaManager } from '../gachamanager'
import { Database } from '../database'
import { Card } from '../types/card';
import { Mutex, MutexInterface, tryAcquire, withTimeout } from 'async-mutex'
import { Auction } from '../auction';
import { Prices } from '../prices';
import { GUI } from '../core/gui';

const locks: Map<string, MutexInterface> = new Map()

const self = module.exports = {
    id_characters: 'abcdefghijkmnpqrstuvwxyz23456789',
    data: new SlashCommandBuilder()
        .setName('sell')
        .setDescription('Sell a card on the auction market')
        .addSubcommand(subcommand =>
            subcommand
                .setName('last')
                .setDescription('Sell the last card you got'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('card')
                .setDescription('Sell a specific card by ID')
                .addNumberOption(option => option.setName('card_id').setRequired(true).setDescription('ID of the card you want to sell'))),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
        const subcommand = message.options.getSubcommand(),
            card_id = message.options.getNumber('card_id')
        
        const inv = await dataManager.getInventory(message.user.id)
        let idx: number
        if (subcommand == "last") {
            idx = inv.length - 1
        } else {
            idx = inv.indexOf(card_id)
        }

        if (idx == -1) {
            Channel.replyNegative(message, "You don't own the card with ID '" + card_id + "'.")
            return
        }
        const card = gacha.getCardById(inv[idx]) as Card
        if (!card) {
            Channel.replyNegative(message, "The card with ID '" + card_id + "' doesn't exist.")
            return
        }

        if (!card.is_auctionable()) {
            Channel.replyNegative(message, "Legendaries & group cards can't be sold !")
            return
        }

        Channel.replyPending(message, "Putting your card on auction ...")
        const auctions = await dataManager.getAllAuctionsPartial()
        const auctions_for_user = auctions.filter(c => c.original_owner_id === user.id);
        if (auctions_for_user.length >= 10) {
            Channel.replyNegative(message, "You can't have more than 10 auctions running at the same time.")
            return
        }
        for (const auction of auctions_for_user) {
            if (auction.card_id == card.id) {
                Channel.replyNegative(message, "You can't sell the same card twice.")
                return
            }
        }

        //LOGIQUE DE VENTE
        const cout_vente = Prices.getAuctionCosts()[card.stars - 1],
            prix_depart = Prices.getAuctionStartingPrices()[card.stars - 1]

        if (user.gems < cout_vente) {
            Channel.replyNegative(message, "You don't have enough `💎` to sell this card. (Fee for this card : **" + cout_vente + "** `💎`)")
            return
        }

        self.sendConfirmMessage(user, message, card, cout_vente, prix_depart, dataManager)
    },
    async generateAuctionID(dataManager: Database) {
        const auctions = await dataManager.getAllAuctionIDs()
        let auction_id = ""
        const all_auction_ids = auctions.map(x => x["auction_id"])
        let retries = 0
        do {
            auction_id = ""
            //auction_id = Math.random().toString(36).substring(2, 5)
            for (let i = 0; i < 5; i++) {
                auction_id += self.id_characters.charAt(Math.floor(Math.random() * self.id_characters.length));
            }
            retries += 1
        } while ((all_auction_ids.includes(auction_id) || auction_id.length < 4 || auction_id.length > 6) && retries < 1000)
        if (retries >= 1000) {
            auction_id = ""
        }
        return auction_id
    },
    sendConfirmMessage(user: User, message: Discord.ChatInputCommandInteraction, card: Card, cout_vente: number, prix_depart: number, dataManager: Database) {
        //Generate mutex if doesn't exist
        if (!locks.has(user.id)) {
            locks.set(user.id, withTimeout(new Mutex(), 100))
        }

        //Msg de confirmation de la vente
        tryAcquire(locks.get(user.id)).acquire().then(async (release) => {
            const star = GUI.getStarFromType(card.type)
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(user.id + "_sell_confirm_" + card.id)
                        .setEmoji("✔️")
                        .setStyle(ButtonStyle.Success)
                )
            const msg = new Discord.EmbedBuilder()
                .setColor("#f1c40f")
                .setDescription('Selling `[' + star.repeat(card.stars) + ']`**' + card.name + '** will cost you **' + cout_vente + "** `💎` as selling fees.\nIt will be sold at a starting price of **" + prix_depart + "** `💎`.\nThe card will be returned if no bids have been placed but you won't get your selling fees back!\nClick on the `✅` button to accept and sell, ignore to cancel.")

            await message.editReply({ embeds: [msg], components: [row] }).catch(() => { })

            const filter = (i:any) => i.customId === user.id + "_sell_confirm_" + card.id && i.user.id === user.id;
            const CANCEL_TIMEOUT = 10000
            const collector = message.channel.createMessageComponentCollector({ filter, time: CANCEL_TIMEOUT });

            setTimeout(() => {
                release()
            }, CANCEL_TIMEOUT);


            let is_selling = false;
            collector.on('collect', async () => {
                if (!is_selling) {
                    is_selling = true;

                    const msg = new Discord.EmbedBuilder()
                        .setAuthor({ name: "Selling ...", iconURL: message.user.avatarURL() })
                        .setColor("#f1c40f")
                        .setDescription("Sending `[" + star.repeat(card.stars) + "]`**" + card.name + "** to the market ...")

                    message.editReply({ components: [], embeds: [msg] }).catch(() => { });

                    const auction_id = await self.generateAuctionID(dataManager)
                    if (auction_id == "") {
                        Channel.replyNegative(message, "Sorry, the auction market seems full. Please try again later !")
                        return
                    }
                    const inv = await dataManager.getInventory(user.id)
                    if (!inv.includes(card.id)) {
                        Channel.replyNegative(message, "You don't own the card with ID '" + card.id + "'.")
                        return
                    }
                    const auction = new Auction(auction_id, card.id, user.id, null, prix_depart, moment().add(8, 'hours'))
                    await dataManager.addGems(user.id, -1 * cout_vente)
                    await dataManager.burnCard(user.id, card.id)
                    await dataManager.addAuction(auction)
                    const confirm_msg = new Discord.EmbedBuilder()
                        .setAuthor({ name: "Selling ...", iconURL: message.user.avatarURL() })
                        .setColor("#32ff7e")
                        .setDescription("You put `[" + star.repeat(card.stars) + "]`**" + card.name + "** on the auction market under the ID of `" + auction_id + "` !\nIt will be sold at a starting price of **" + prix_depart + "** `💎`.\nCheck your current auctions anytime with **/auc me**.")
                    Channel.reply(message, confirm_msg)
                }
            });

            collector.on('end', async collected => {
                if (collected.size == 0) {
                    const msg = new Discord.EmbedBuilder()
                        .setAuthor({ name: "Selling cards ...", iconURL: message.user.avatarURL() })
                        .setColor("#f39c12")
                        .setDescription("You didn't sell **" + card.name + "**.")

                    await message.editReply({ embeds: [msg], components: [] }).catch(() => { });
                }
                collector.stop();
            });
        }).catch(() => {
            Channel.replyNegative(message, "Wait for the confirmation to expire before selling another card.");
        })
    }
}