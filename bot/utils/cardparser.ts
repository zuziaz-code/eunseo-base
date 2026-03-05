import { Rarity } from "../rarity"
import { Card } from "../types/card"

export class CardParser {
	mapRarities(rawData:any[]) : Rarity[] {
		const rarities = rawData.map(rarity => new Rarity(
			rarity.name,
			rarity.color,
			rarity.stars,
			rarity.minWeightInverse
		))

		return rarities
	}
	mapRewards(rawData:any[]): Card[] {
		const rewards = rawData.map(reward => new Card(
			reward.id,
			reward.name,
			reward.suffix,
			reward.stars,
			reward.image,
			reward.group,
			reward.type,
			reward.idol_name,
			reward.era_name
		))

		return rewards
	}
}