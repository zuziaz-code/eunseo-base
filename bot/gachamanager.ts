import { Random } from "./utils/random"
import { Card } from "./types/card"
import { Rarity } from "./rarity"

export class GachaManager {
	private rewards: Card[]
	private rarities: Rarity[]
	private rewardsMap: { [id: number]: Card } = {};
	constructor(rewards: Card[], rarities: Rarity[]) {
		this.rewards = rewards
		this.rarities = rarities
		this.rewards.forEach(reward => this.rewardsMap[reward.id] = reward);
	}
	setRewards(rewards: Card[]) {
		this.rewards = rewards
		this.rewards.forEach(reward => this.rewardsMap[reward.id] = reward);
	}
	setRarities(rarities: Rarity[]) {
		this.rarities = rarities
	}
	gacha(): Card {
		const rarity = this.getPullRarity(Random.getRandomFloat(0, 1))
		return this.getPullReward(rarity)
	}
	getPullRarity(luck: number) {
		for (const rarity of this.rarities) {
			if (luck >= 1 - rarity.minWeightInverse) {
				return rarity
			}
		}
		return this.rarities[0]
	}
	getPullReward(rarity: Rarity): Card {
		const target_stars = rarity.stars
		const possibleRewards = this.rewards.filter(reward => {
			return reward.stars == target_stars && reward.suffix == "" && reward.type == "common"
		})
		return Random.getRandomItem(possibleRewards)
	}
	getCardById(id: number) {
		return this.rewardsMap[id] || null;
	}
	getRarityByStars(stars: number) {
		for (const rarity of this.rarities) {
			if (rarity.stars === stars)
				return rarity
		}
		return null
	}
	getAllCards(): Card[] {
		return this.rewards
	}
	getAllRewardsByEra(era_name: string): Card[] {
		const all_rewards = []

		for (const reward of this.rewards) {
			if (reward.era_name == era_name)
				all_rewards.push(reward)
		}
		return all_rewards
	}
	getColorForCard(rarity: Rarity, card_type: string): string {
		return "#2c3e50" // Implement your colors here
	}
}