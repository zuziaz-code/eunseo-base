import { Card } from "./types/card"

export class Prices {
    static BURN_PRICES = [10, 20, 50, 100, 100]
    static CRAFT_PRICES = [400, 800, 1500, 5000]
    static AUC_START_PRICES = [250, 500, 1000, 2000, 5000, 10000, 20000]
    static AUC_COSTS = [25, 50, 100, 200, 1000, 2000, 4000]
    static GACHA_PRICE = 100

	static getCraftPrices() {
        return this.CRAFT_PRICES
    }

    static getBurnPrices(reward: Card) {
        if (["group", "legendary", "group-legendary", "anniversary"].includes(reward.type)) {
            return 0
        }
        return Prices.BURN_PRICES[reward.stars - 1]
    }

    static getAuctionStartingPrices() {
        return this.AUC_START_PRICES
    }

    static getAuctionCosts() {
        return this.AUC_COSTS
    }
}