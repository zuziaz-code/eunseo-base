 
import { User } from './user';
import { Auction } from './auction'
import { Db } from 'mongodb';
import moment from 'moment'
import { Utils } from './utils/utils';
import { DbQuery, GachaDocument, FavsDocument, WishlistDocument } from './types/types';

export { DbQuery };

export class Database {
	db: Db
	constructor(db: Db) {
		this.db = db
	}
	async getUser(id: string) {
		const result = await this.db.collection("users").findOne({ "user_id": id })
		if (!result) {
			return null
		} else {
			return new User(result.name, result.user_id, result.gems, result.dust, result.banned, result.type)
		}
	}
	async changeUsername(user_id: string, new_username: string) {
		await this.db.collection("users").updateOne({ "user_id": user_id }, { $set: { "name": new_username } })
	}
	async addUser(user_id: string, name: string) {
		await this.db.collection("users").insertOne({ "user_id": user_id, "name": name, "gems": 0, "dust": 0 })
		await this.db.collection<GachaDocument>("gachas").insertOne({ "user_id": user_id, "gachas": [] })
		await this.db.collection<FavsDocument>("favs").insertOne({ "user_id": user_id, "favs": [] })
	}
	async addGems(id: string, added_gems: number): Promise<number> {
		const result = await this.db.collection("users").findOneAndUpdate(
			{ "user_id": id },
			{ $inc: { "gems": added_gems } },
			{ returnDocument: 'after' })
		return result.gems
	}
	async removeGems(user_id: string, removed_gems: number) {
		await this.db.collection("users").updateOne({ "user_id": user_id }, { $inc: { "gems": -removed_gems } })
	}
	async replaceOrAddCountdown(user_id: string, type: string, end_countdown: string) {
		await this.db.collection(type).updateOne({ "user_id": user_id },
			{ $set: { "end_countdown": end_countdown } },
			{ upsert: true })
	}
	async getCountdown(user_id: string, type: string): Promise<string> {
		const result = await this.db.collection(type).find({ "user_id": user_id }).toArray()
		if (!result || result.length == 0) {
			return null
		} else {
			if (result.length == 1) {
				return result[0].end_countdown
			} else {
				await this.deleteCountdown(user_id, type)
				const result2 = await this.getCountdown(user_id, type)
				return result2
			}
		}
	}
	private async deleteCountdown(user_id: string, type: string) {
		await this.db.collection(type).deleteOne({ "user_id": user_id })
	}
	async addGacha(user_id: string, card_id: number) {
		await this.db.collection<GachaDocument>("gachas").updateOne(
			{ "user_id": user_id },
			{ $push: { gachas: card_id } })
	}
	async getInventory(user_id: string): Promise<number[]> {
		const result = await this.db.collection<GachaDocument>("gachas").findOne({ "user_id": user_id }, { projection: { "_id": 0 } })
		if (!result || !result.gachas) {
			return []
		} else {
			return Utils.getUniqueArray(result.gachas)
		}
	}
	async favCard(user_id: string, card_id: number) {
		await this.db.collection<FavsDocument>("favs").updateOne(
			{ "user_id": user_id },
			{ $push: { favs: card_id } })
	}
	async unfavCard(user_id: string, card_id: number) {
		await this.db.collection<FavsDocument>("favs").updateOne(
			{ "user_id": user_id },
			{ $pull: { favs: card_id } })
	}
	async getFavs(user_id: string): Promise<number[]> {
		const result = await this.db.collection<FavsDocument>("favs").findOne({ "user_id": user_id })
		if (!result || !result.favs) {
			return []
		} else {
			return result.favs
		}
	}
	async setFavs(user_id: string, newFavs: number[]): Promise<void> {
		await this.db.collection<FavsDocument>("favs").updateOne(
			{ "user_id": user_id },
			{ $set: { favs: newFavs } },
			{ upsert: true }
		);
	}

	async burnCard(user_id: string, card_id: number) {
		await this.db.collection<GachaDocument>("gachas").updateOne(
			{ "user_id": user_id },
			{ $pull: { gachas: card_id } })
	}
	async addNuts(id: string, added_dust: number) {
		const result = await this.db.collection("users").findOneAndUpdate(
			{ "user_id": id },
			{ $inc: { "dust": added_dust } },
			{ returnDocument: 'after' })
		return result.dust
	}
	async removeNuts(user_id: string, removed_nuts: number): Promise<number> {
		const result = await this.db.collection("users").findOneAndUpdate(
			{
				"user_id": user_id,
				"dust": { $gte: removed_nuts }
			},
			{ $inc: { "dust": -removed_nuts } },
			{ returnDocument: 'after' }
		);

		if (!result) {
			const user = await this.db.collection("users").findOne({ "user_id": user_id });
			return user ? user.dust : 0;
		}

		return result.dust;
	}
	async burnMultipleCards(user_id: string, burn_list: number[]) {
		if (burn_list.length == 0) {
			return
		} else {
			await this.db.collection<GachaDocument>("gachas").updateOne(
				{ "user_id": user_id },
				{ $pull: { gachas: { $in: burn_list } } })
		}
	}
	async addMultipleGachas(user_id: string, card_list: number[]) {
		if (card_list.length == 0) {
			return
		} else {
			await this.db.collection<GachaDocument>("gachas").updateOne(
				{ "user_id": user_id },
				{ $push: { gachas: { $each: card_list } } })
		}
	}
	async addAuction(auction: Auction) {
		await this.db.collection("auctions").insertOne({
			"auction_id": auction.auction_id,
			"card_id": auction.card_id,
			"original_owner_id": auction.original_owner_id,
			"current_winner_id": auction.current_winner_id,
			"price": auction.price,
			"end_time": auction.end_time.format()
		})
	}
	async getAllAuctions(query: DbQuery): Promise<Auction[]> {
		const results = await this.db.collection("auctions").find(query).toArray()
		if (!results) {
			return []
		} else {
			const auc_results = []
			for (const r of results) {
				auc_results.push(new Auction(r.auction_id, r.card_id, r.original_owner_id, r.current_winner_id, r.price, moment(r.end_time)))
			}
			return auc_results
		}
	}
	async getAllAuctionsPartial(): Promise<Auction[]> {
		const results = await this.db.collection("auctions").find({}).project({ "auction_id": 1, "original_owner_id": 1 }).toArray()
		if (!results) {
			return []
		} else {
			const auc_results = []
			for (const r of results) {
				auc_results.push(new Auction(r.auction_id, r.card_id, r.original_owner_id, r.current_winner_id, r.price, moment(r.end_time)))
			}
			return auc_results
		}
	}
	async getAllAuctionIDs() {
		const results = await this.db.collection("auctions").find({}).project({ "auction_id": 1 }).toArray()
		if (!results) {
			return []
		} else {
			const auc_results = []
			for (const r of results) {
				auc_results.push(new Auction(r.auction_id, r.card_id, r.original_owner_id, r.current_winner_id, r.price, moment(r.end_time)))
			}
			return auc_results
		}
	}
	async getAuction(auction_id: string) {
		const r = await this.db.collection("auctions").findOne({ "auction_id": auction_id })
		if (!r) {
			return null
		} else {
			return new Auction(r.auction_id, r.card_id, r.original_owner_id, r.current_winner_id, r.price, moment(r.end_time))
		}
	}
	async deleteAuction(auction_id: string) {
		await this.db.collection("auctions").deleteOne({ "auction_id": auction_id })
	}
	async addBidOnAuction(auction_id: string, bidder_id: string, new_price: number) {
		await this.db.collection("auctions").findOneAndUpdate(
			{ "auction_id": auction_id },
			{ $set: { "price": new_price, "current_winner_id": bidder_id } },
			{ returnDocument: 'after' })
	}
	async updateAuctionEnd(auction_id: string, new_end: moment.Moment) {
		await this.db.collection("auctions").findOneAndUpdate(
			{ "auction_id": auction_id },
			{ $set: { "end_time": new_end.format() } },
			{ returnDocument: 'after' })
	}
	async getProfile(user_id: string): Promise<string> {
		const result = await this.db.collection("profiles").findOne({ "user_id": user_id })
		if (result) {
			return result.bio
		} else {
			return null
		}
	}
	async setProfile(user_id: string, new_bio: string) {
		await this.db.collection("profiles").insertOne({ "user_id": user_id, "bio": new_bio })
	}
	async deleteProfile(user_id: string) {
		await this.db.collection("profiles").deleteOne({ "user_id": user_id })
	}
	async getFeaturedCard(user_id: string): Promise<number> {
		const res = await this.db.collection("featured_cards").findOne({ "user_id": user_id })
		if (res) {
			return res.card_id
		} else {
			return null
		}
	}
	async setFeaturedCard(user_id: string, card_id: number): Promise<void> {
		await this.db.collection("featured_cards").insertOne({ "user_id": user_id, "card_id": card_id })
	}
	async deleteFeaturedCard(user_id: string): Promise<void> {
		await this.db.collection("featured_cards").deleteOne({ "user_id": user_id })
	}

	// Fancafe methods
	getFancafe(user_id: string): Promise<any> {
		return this.db.collection("fancafes").findOne({ "user_id": user_id })
	}

	async createFancafe(user_id: string): Promise<void> {
		await this.db.collection("fancafes").insertOne({
			"user_id": user_id,
			"created_at": new Date(),
			"shelves": [
				{
					"name": "Featured Collection",
					"cards": []
				}
			]
		})
	}

	async updateFancafeShelves(user_id: string, shelves: Array<{name: string, cards: number[], color?: string, borderColor?: string}>): Promise<void> {
		await this.db.collection("fancafes").updateOne(
			{ "user_id": user_id },
			{ $set: { "shelves": shelves } }
		)
	}

	async addFancafeShelf(user_id: string, shelfName: string): Promise<boolean> {
		const fancafe = await this.getFancafe(user_id)
		if (!fancafe || fancafe.shelves.length >= 3) {
			return false
		}
		fancafe.shelves.push({ name: shelfName, cards: [] })
		await this.updateFancafeShelves(user_id, fancafe.shelves)
		return true
	}

	async removeFancafeShelf(user_id: string, shelfIndex: number): Promise<boolean> {
		const fancafe = await this.getFancafe(user_id)
		if (!fancafe || shelfIndex < 0 || shelfIndex >= fancafe.shelves.length || fancafe.shelves.length <= 1) {
			return false
		}
		fancafe.shelves.splice(shelfIndex, 1)
		await this.updateFancafeShelves(user_id, fancafe.shelves)
		return true
	}
	async getToggle(toggle_name: string) {
		const result = await this.db.collection("toggles").findOne({ "type": toggle_name }, { projection: { activated: 1 } })
		return result.activated as boolean
	}
	async getSlowmode(): Promise<number> {
		const result = await this.db.collection("slowmode").findOne({ "type": "slowmode" }, { projection: { slowmode: 1 } })
		return result.slowmode
	}
	async addWish(user_id: string, card_id: number) {
		await this.db.collection<WishlistDocument>("wishlists").updateOne(
			{ "user_id": user_id },
			{ $push: { wishlist: card_id } })
	}
	async removeWish(user_id: string, card_id: number) {
		await this.db.collection<WishlistDocument>("wishlists").updateOne(
			{ "user_id": user_id },
			{ $pull: { wishlist: card_id } })
	}
	async getWishlist(user_id: string): Promise<number[]> {
		const result = await this.db.collection<WishlistDocument>("wishlists").findOne({ "user_id": user_id })
		if (!result || !result.wishlist) {
			await this.createWishlist(user_id)
			return []
		} else {
			return result.wishlist
		}
	}
	private async createWishlist(user_id: string): Promise<void> {
		await this.db.collection<WishlistDocument>("wishlists").insertOne({ "user_id": user_id, "wishlist": [] })
	}
	async getTradeLink(user_1: string, user_2: string) {
		const result = await this.db.collection("links_trade").findOne({ $or: [{ user_1: user_1, user_2: user_2 }, { user_2: user_1, user_1: user_2 }], "start_day": { $exists: true } })
		return result
	}
	private async addAucLink(user_1: string, user_2: string) {
		await this.db.collection("links_auc").insertOne({ "user_1": user_1, "user_2": user_2, "count": 1 })
	}
	private async incrementAucLink(user_1: string, user_2: string) {
		await this.db.collection("links_auc").findOneAndUpdate({ $or: [{ user_1: user_1, user_2: user_2 }, { user_2: user_1, user_1: user_2 }] }, { $inc: { "count": 1 } })
	}
	private async getAucLink(user_1: string, user_2: string) {
		const result = await this.db.collection("links_auc").findOne({ $or: [{ user_1: user_1, user_2: user_2, "count": 1 }, { user_2: user_1, user_1: user_2 }] })
		return result
	}
	async addOrUpdateAucLink(user_1: string, user_2: string) {
		const result = await this.getAucLink(user_1, user_2)
		if (result) {
			void this.incrementAucLink(user_1, user_2)
		} else {
			void this.addAucLink(user_1, user_2)
		}
	}
	async getGachaOrbs(user_id: string): Promise<number> {
		const result = await this.db.collection("gacha_orbs").findOne({ "user_id": user_id })
		if (!result) {
			return 0
		} else {
			return result.orbs
		}
	}
	async removeGachaOrbs(user_id: string, amount: number) {
		await this.db.collection("gacha_orbs").updateOne(
			{ "user_id": user_id },
			{ $inc: { "orbs": -amount } })
	}
	async acquireLock(): Promise<boolean> {
		try {
			const res = await this.db.collection("auction_lock").insertOne({ "lock": 'lock' }, { writeConcern: { w: "majority" } });
			return !!res.insertedId;
		} catch (e: any) {
			// Duplicate key error means lock is already acquired
			if (e.code === 11000) {
				return false;
			}
			throw e;
		}
	}
	async releaseLock(): Promise<void> {
		await this.db.collection("auction_lock").deleteOne({ "lock": 'lock' });
	}
}
