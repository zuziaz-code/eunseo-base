
export class User {
	name: string
	id: string
	gems: number
	dust: number
	banned: boolean
	type: string
	constructor(name: string, id: string, gems: number, dust: number, banned = false, type = "") {
		this.name = name
		this.id = id
		this.gems = gems
		this.dust = dust
		this.banned = banned
		this.type = type
	}
	getColor() : string {
		return "#7ed6df"
	}
	getOriginalInventoryLimit() : number {
		return 1000
	}
	getGemsLimit() : number {
		return 20000000
	}
}