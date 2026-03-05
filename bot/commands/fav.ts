import Discord, { SlashCommandBuilder } from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import { GachaManager } from '../gachamanager'
import { Database } from '../database'
import { Card } from '../types/card';
import { GUI } from '../core/gui';
import { Filters } from '../utils/filters';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fav')
        .setDescription('Mark a card as favorite')
        .addSubcommand(subcommand =>
            subcommand
                .setName('last')
                .setDescription('Fav the last card(s) you got')
                .addNumberOption(option => option.setName('number').setDescription('Number of last cards you want to fav')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cards')
                .setDescription('Fav specific card(s) by ID')
                .addStringOption(option => option.setName('card_ids').setDescription('List of card IDs to fav (separated by spaces)').setRequired(true))),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
        const subcommand = message.options.getSubcommand(),
            card_ids = message.options.getString('card_ids')
        let nb_favs = message.options.getNumber('number')

        const inv = await dataManager.getInventory(message.user.id),
            index_of_fav_cards: number[] = []
        if (subcommand == "last") {
            if (nb_favs == null) {
                nb_favs = 1
            }
            if (nb_favs <= 0 || nb_favs > 10) {
                Channel.replyNegative(message, "Min 1 / Max 10 favs at a time.\n/fav last is to fav the X last cards you got."); return;
            }
            for (let i = inv.length - nb_favs; i < inv.length; i++) {
                index_of_fav_cards.push(i)
            }
        } else {
            const card_args = card_ids.split(/\s+/);
            if (card_args.length == 0) {
                Channel.replyNegative(message, "You must specify at least one card ID. (Example : /fav cards 1245)"); return;
            }
            for (const arg of card_args) {
                let card_id = parseInt(arg)
                if (isNaN(card_id) || !Filters.isNumeric(arg)) {
                    Channel.replyNegative(message, "You can only put card IDs as parameters, separated by spaces.\nExample : /fav cards 1234 5678."); return;
                }
                if (!inv.includes(card_id)) {
                    Channel.replyNegative(message, "You can't mark a card as favorite if you don't own it ! (" + card_id + ")"); return;
                }
                let i = inv.indexOf(card_id)
                if (!index_of_fav_cards.includes(i)) {
                    index_of_fav_cards.push(i)
                }
            }
        }

        const fav_cards = []
        let desc = ""
        for (const idx of index_of_fav_cards) {
            const card = gacha.getCardById(inv[idx]) as Card
            if (!card) {
                Channel.replyNegative(message, "Sorry, the card you marked was invalid."); return;
            }
            fav_cards.push(card)
            const star = GUI.getStarFromType(card.type) as string
            await dataManager.favCard(user.id, card.id)
            desc += "`[" + star.repeat(card.stars) + "]` **" + card.name + "**\n"
        }

        const title = fav_cards.length == 1 ? "`💖` **You marked a card as favorite !**" : "`💖` **You marked " + fav_cards.length + " cards as favorites !**"

        if (fav_cards.length > 0) {
            const msg = new Discord.EmbedBuilder()
                .setAuthor({ name: "Marking cards ...", iconURL: message.user.avatarURL() })
                .setColor("#2ecc71")
                .setTitle(title)

            if (desc.length < 2048) {
                msg.setDescription(desc)
            }

            Channel.reply(message, msg)
        }
    }
}