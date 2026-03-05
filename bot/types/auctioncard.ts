import { Auction } from '../auction'
import { Card } from "./card"

export class AuctionCard {
    auction: Auction
    rew: Card

    constructor(auction: Auction, reward: Card) {
        this.auction = auction
        this.rew = reward
    }
}