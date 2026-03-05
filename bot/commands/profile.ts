import { SlashCommandBuilder } from 'discord.js';
import Discord from 'discord.js'
import { User } from '../user'
import { Channel } from '../core/channel'
import { GachaManager } from '../gachamanager'
import { Database } from '../database'
import { GUI } from '../core/gui';
import numeral from 'numeral'
import { Utils } from '../utils/utils';

type CardCount = Record<string, number>;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('See or edit your profile')
        .addUserOption(option => option.setName('user').setDescription('Get the profile of another user'))
        .addStringOption(option => option.setName('new_bio').setDescription('New bio you want to put up'))
        .addNumberOption(option => option.setName('featured_card').setDescription('ID of the card you want featured')),
    async execute(message: Discord.ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
        let target_user = message.options.getUser('user'),
            new_bio = message.options.getString('new_bio')
        const featured_card_id = message.options.getNumber('featured_card');
        if (target_user && target_user.id != message.user.id && (new_bio || featured_card_id)) {
            Channel.replyNegative(message, "You can't change the profile of another user !");
            return
        }
        target_user = target_user || message.user;
        const target_user_id = target_user.id;

        if (!new_bio && !featured_card_id) {
            const target_user = await dataManager.getUser(target_user_id)

            const [
                inv,
                old_favs,
                temp_profile,
                temp_featured_card_id
            ] = await Promise.all([
                dataManager.getInventory(target_user_id),
                dataManager.getFavs(target_user_id),
                dataManager.getProfile(target_user_id),
                dataManager.getFeaturedCard(target_user_id)
            ]);

            const favs = Utils.getUniqueArray(old_favs.filter(fav => inv.includes(fav)))
            if (favs.length !== old_favs.length) {
                await dataManager.setFavs(target_user_id, favs)
            }

            let profile = temp_profile,
                featured_card_id = temp_featured_card_id
            if (!profile) {
                profile = "Your bio will go here !"
            } else {
                profile = profile.replace("@", "").replace("https://", "").replace("http://", "").replace("www.", "").replace("||", "")
            }
            const all_cards = inv.map(x => gacha.getCardById(x)).filter(x => x !== null && x !== undefined),
                all_types = all_cards.map(x => x.type);
            const card_count: CardCount = all_types.reduce((cnt: CardCount, cur: string) => {
                if (cur) { // Avoid counting empty strings
                    cnt[cur] = (cnt[cur] || 0) + 1;
                }
                return cnt;
            }, {} as CardCount);

            const card_types = GUI.getCardTypes().reduce((acc, cur) => {
                if (cur !== "staff") {
                    acc.push(cur)
                }
                return acc
            }, [])
            card_types.forEach(x => {
                if (!Object.keys(card_count).includes(x)) {
                    card_count[x] = 0
                }
            })

            const nb_orbs = await dataManager.getGachaOrbs(target_user_id)

            let type_count = ""
            for (const type of card_types) {
                type_count += card_count[type] + " `" + GUI.getStarFromType(type) + "` / "
                if (type === "lottery") {
                    type_count += "\n"
                }
            }
            type_count = type_count.slice(0, -2)
            const nb_favs = (favs.length > all_cards.length) ? all_cards.length : favs.length

            const msg = new Discord.EmbedBuilder()
                .setTitle("`🌟` Profile Card - " + target_user.name + " `🌟`")
                .setDescription("`🎴` **Collection** : **" + all_cards.length
                    + "** cards\n`💖` **Favorites** : **" + nb_favs
                    + "** cards\n`💎` **Gems** : **" + numeral(target_user.gems).format('0,0')
                    + "** `💎`\n`🥜` **Peanuts** : **" + numeral(target_user.dust).format('0,0')
                    + "** `🥜`\n`🎁` **Gacha Orbs** : **" + numeral(nb_orbs).format('0,0')
                    + "** " + GUI.ORB_ICON + "\n"
                    + "**`🎴` | " + type_count + "**\n\n" + profile)

            if (featured_card_id && inv.includes(featured_card_id)) {
                const featured_card = gacha.getCardById(featured_card_id)
                if (featured_card) {
                    msg.setImage(featured_card.image)
                }
            }

            Channel.reply(message, msg)
        } else { //Set new bio
            if (new_bio) {
                new_bio = new_bio.replace("@", "").replace("https://", "").replace("http://", "").replace("www.", "").replace("porn", "").replace(".com", "").replace("||", "").replace("youtube", "").replace("tiktok", "")
                if (new_bio.length > 1000) {
                    Channel.replyNegative(message, "Sorry, your bio is too long.\nOnly up to 1000 characters are allowed.")
                    return
                }
                await dataManager.deleteProfile(user.id)
                await dataManager.setProfile(user.id, new_bio)
                Channel.replyPositive(message, "Your profile was successfully updated !")
                return
            }
            if (featured_card_id) {
                const inv = await dataManager.getInventory(user.id),
                    featured_card = gacha.getCardById(featured_card_id)
                if (!inv.includes(featured_card_id)) {
                    Channel.replyNegative(message, "You don't have card n°" + featured_card_id + " in your inventory.")
                    return
                }
                if (!featured_card) {
                    Channel.replyNegative(message, "Card n°" + featured_card_id + " doesn't exist.")
                    return
                }

                await dataManager.deleteFeaturedCard(user.id)
                await dataManager.setFeaturedCard(user.id, featured_card_id)
                Channel.replyPositive(message, "Your profile was successfully updated !")
                return
            }
        }
    },
    titleCase(string: string) {
        return string[0].toUpperCase() + string.substr(1).toLowerCase()
    }
}