export class Rarity {
	name:string
	color:string
	stars:number
	minWeightInverse:number
	constructor (name: string, color: string, stars: number, minWeightInverse: number) {
		this.name = name
		this.color = color
		this.stars = stars
		this.minWeightInverse = minWeightInverse
	}
}