import moment from "moment"
import { Database } from './database'
import { Shard } from 'discord.js'
import { GachaManager } from "./gachamanager"
import { Card } from './types/card'
import { GUI } from "./core/gui"

export class Auction {
    auction_id: string
    card_id: number
    original_owner_id: string
    current_winner_id: string
    price: number
    end_time: moment.Moment
    constructor(auction_id: string, card_id: number, original_owner_id: string, current_winner_id: string, price: number, end_time: moment.Moment) {
        this.auction_id = auction_id
        this.card_id = card_id
        this.card_id = card_id
        this.original_owner_id = original_owner_id
        this.current_winner_id = current_winner_id
        this.price = price
        this.end_time = end_time
    }
    isFinished() {
        return moment().isAfter(this.end_time)
    }
    hasWinner() {
        return this.current_winner_id != null
    }
    async closeAuction(dataManager: Database, gacha: GachaManager, shard: Shard) {
        const auc = await dataManager.getAuction(this.auction_id)
        if (!auc) {
            return
        }
        if (this.hasWinner()) {
            await dataManager.addGems(this.original_owner_id, this.price)
            await dataManager.addGacha(this.current_winner_id, this.card_id)
            await dataManager.deleteAuction(this.auction_id)

            const card = gacha.getCardById(this.card_id)

            await dataManager.addOrUpdateAucLink(this.original_owner_id, this.current_winner_id)

            const seller = await dataManager.getUser(this.original_owner_id)
            const winner = await dataManager.getUser(this.current_winner_id)
            const star = GUI.getStarFromType(card.type)

            let card_name = ""
            if (card.suffix != "") {
                card_name = "`[" + star.repeat(card.stars) + "]` **" + card.name + "** (Ver. " + card.suffix + ")"
            } else {
                card_name = "`[" + star.repeat(card.stars) + "]` **" + card.name + "**"
            }

            const msg_a = {
                color: "#2ecc71",
                description: "You won" + card_name + " on the auction market !\nYou paid **" + this.price + "** `💎` for this card."
            }

            const msg_b = {
                color: "#2ecc71",
                description: "Your card " + card_name + " was successfully sold on the auction market !\nYou received **" + this.price + "** `💎` for this card."
            }

            await shard.send({ type: 'sendMessage', data: { userId: winner.id, embed: msg_a } }).catch(() => { })
            await shard.send({ type: 'sendMessage', data: { userId: seller.id, embed: msg_b } }).catch(() => { })
        } else {
            await dataManager.addGacha(this.original_owner_id, this.card_id)
            await dataManager.deleteAuction(this.auction_id)
            const card = gacha.getCardById(this.card_id) as Card
            const msg = {
                color: "#e67e22",
                description: "Unfortunately no one has bid on your **" + card.name + "** card !\nIt's back in your inventory."
            }

            await shard.send({ type: 'sendMessage', data: { userId: this.original_owner_id, embed: msg } }).catch(() => { })
        }
    }
}