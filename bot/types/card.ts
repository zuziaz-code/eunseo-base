export class Card {
	id: number
	name: string
	suffix:string
	stars:number
	image:string
	group:string
	type:string
	idol_name:string
	era_name:string
	constructor (id: number, name: string, suffix: string, stars: number, image: string, group: string, type:string, idol_name:string, era_name:string) {
		this.id = id
		this.name = name
		this.suffix = suffix
		this.stars = stars
		this.image = image
		this.group = group
		this.type = type
		this.idol_name = idol_name
		this.era_name = era_name
	}

	is_craftable() : boolean {
		return this.type == "common"
	}
	is_tradeable(): boolean {
		return true // Implement your conditions here
	}
	is_auctionable(): boolean {
		return true // Implement your conditions here
	}
	is_mass_burnable(): boolean {
		return true // Implement your conditions here
	}
	is_alt(): boolean {
		return this.suffix != "" && !["group-legendary", "legendary"].includes(this.type)
	}
}