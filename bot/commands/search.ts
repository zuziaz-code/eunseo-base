import { SlashCommandBuilder } from 'discord.js';
import Discord, { ButtonStyle } from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import { GachaManager } from '../gachamanager'
import { Database } from '../database'
import { Filters } from '../utils/filters';
import { GUI } from '../core/gui';
import { Pages } from '../core/pages';

module.exports = {
	data: new SlashCommandBuilder()
		.setName('search')
		.setDescription('Search cards in the database')
		.addStringOption(option => option.setName('query').setDescription('Search by card names'))
		.addStringOption(option => option.setName('group').setDescription('Search by group'))
		.addStringOption(option => option.setName('era').setDescription('Search by era'))
		.addStringOption(option => option.setName('idol').setDescription('Search by idol'))
		.addNumberOption(option => option.setName('rarity').setDescription('Filter by number of stars').addChoices(
			{ name: '1 star', value: 1 },
			{ name: '2 stars', value: 2 },
			{ name: '3 stars', value: 3 },
			{ name: '4 stars', value: 4 },
			{ name: '5 stars', value: 5 },
		))
		.addBooleanOption(option => option.setName('is_alt').setDescription('Include/exclude alt cards (Ver B/C)'))
		.addBooleanOption(option => option.setName('in_my_inv').setDescription('Include/exclude cards in your inv'))
		.addStringOption(option => option.setName('type').setDescription('Search by card type').addChoices(
			{ name: 'Group Legendary', value: 'group-legendary' },
			{ name: 'Legendary', value: 'legendary' },
			{ name: 'Event', value: 'event' },
			{ name: 'Common', value: 'common' },
			{ name: 'Group', value: 'group' },
		)),
	async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
		const all_results = gacha.getAllCards(),
			query = message.options.getString('query'),
			group = message.options.getString('group'),
			era = message.options.getString('era'),
			idol = message.options.getString('idol'),
			type = message.options.getString('type'),
			rarity = message.options.getNumber('rarity'),
			is_alt = message.options.getBoolean('is_alt'),
			inMyInv = message.options.getBoolean('in_my_inv');

		const inv = await dataManager.getInventory(user.id)

		//Filter stuff
		const filtered_results = []
		for (const reward of all_results) {
			if (!reward || !reward.id) {
				continue
			}
			if (reward.type == "staff") {
				continue
			}
			if (group && group != "" && reward.group.toLowerCase() != group.toLowerCase()) {
				continue
			}
			if (query && query != "" && !reward.name.toLowerCase().includes(query.toLowerCase())) {
				continue
			}
			if (idol && idol != "" && reward.idol_name.toLowerCase() != idol.toLowerCase()) {
				continue
			}
			if (era && era != "" && reward.era_name.toLowerCase() != era.toLowerCase()) {
				continue
			}
			if (type && type != "" && reward.type.toLowerCase() != type.toLowerCase()) {
				continue
			}
			if (rarity && reward.stars != rarity) {
				continue
			}
			if (is_alt !== undefined && is_alt !== null) {
				if (is_alt && !reward.is_alt()) {
					continue
				}
				if (!is_alt && reward.is_alt()) {
					continue
				}
			}
			if (inMyInv !== undefined && inMyInv !== null) {
				if (inMyInv && !inv.includes(reward.id)) {
					continue
				}
				if (!inMyInv && inv.includes(reward.id)) {
					continue
				}
			}
			filtered_results.push(reward)
		}

		const nb_pages = Math.ceil(filtered_results.length / 7)

		if (nb_pages == 0) {
			Channel.replyNegative(message, "No cards in the bot matched these filters.")
			return
		}
		filtered_results.sort(Filters.compareStars)

		const wishlist = await dataManager.getWishlist(user.id)
		const pages = []
		const filter_count = [query, group, era, idol, type, rarity].filter(Boolean).length;
		let title: string,
			title_emote = "`🔎` "
		if (filter_count >= 2) {
			title = title_emote + "Listing all cards matching " + filter_count + " filters"
		} else if (filter_count == 1) {
			title = title_emote + "Listing all cards matching " + filter_count + " filter"
		} else {
			title = title_emote + "Listing all cards currently available"
		}

		for (let current_page = 1; current_page < nb_pages + 1; current_page++) {
			let idx = (current_page - 1) * 7

			let content = ""
			let stop_adding = false
			while (idx < filtered_results.length && !stop_adding && idx < current_page * 7) {
				let reward = filtered_results[idx],
					star = GUI.getStarFromType(reward.type),
					add_content = "`" + reward.id + " [" + star.repeat(reward.stars) + "]`" + "  ".repeat(7 -reward.stars)

				if (reward.suffix != "" && !["legendary", "halloween", "xmas", "seasons", "anniversary"].includes(reward.type)) {
					add_content += "[" + reward.name + " (Ver. " + reward.suffix + ")](" + reward.image + ") `" + reward.group + "`"
				} else {
					add_content += "[" + reward.name + "](" + reward.image + ") `" + reward.group + "`"
				}
				if (wishlist.includes(reward.id)) {
					add_content += " `💭`"
				}
				add_content += (inv.includes(reward.id)) ? " `🎒`\n" : "\n"


				if (content.length + add_content.length >= 2048) {
					stop_adding = true
				} else {
					content += add_content
				}
				idx += 1
			}

			pages.push(new Discord.EmbedBuilder()
				.setColor("#e84393")
				.setTitle(title)
				.setDescription(content))
		}

		const button1 = new Discord.ButtonBuilder()
			.setCustomId('eunPbtn' + user.id)
			.setLabel('Previous')
			.setStyle(ButtonStyle.Danger);

		const button2 = new Discord.ButtonBuilder()
			.setCustomId('eunNbtn' + user.id)
			.setLabel('Next')
			.setStyle(ButtonStyle.Success);

		let footer = ""
		if (query && query != "") {
			footer = "- Try the 'group' filter if you can't find what you're looking for."
		}

		void Pages.paginateSlash(['eunPbtn' + user.id, 'eunNbtn' + user.id], message, pages, [button1, button2], 45000, user.id, footer);
	}
}