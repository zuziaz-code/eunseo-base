import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import moment from 'moment';
import { sharedDatabase } from './core/sharedDatabase';
import Discord, { Client, Collection, GatewayIntentBits, Partials, ActivityType, PermissionsBitField, Options, Events } from 'discord.js';
import { GachaManager } from './gachamanager';
import { CardParser } from './utils/cardparser';
import { Database } from './database';
import { User } from './user'
import { performance } from 'perf_hooks';
import { Mutex, MutexInterface, tryAcquire, withTimeout } from 'async-mutex';
import { parentPort } from 'worker_threads';
import { Channel } from './core/channel';
import raritiesRawData from "../data/rarities.json"
import rewardsRawData from "../data/cards.json"
import winston, { createLogger, format, transports } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { PortMessage } from './types/types';

export class Main {
	client: Discord.Client
	dataManager: Database
	gacha: GachaManager
	all_slash_commands: string[] = []
	logger: winston.Logger
	cmd_logger: winston.Logger
	slashCommands: Discord.Collection<string, any>
	static bot_version: string
	static this_minute_timestamp = moment().format("YYYY-MM-DD HH:mm")
	static this_minute_counter = 0
	static locks: Map<string, MutexInterface> = new Map()
	static slash_locks: Map<string, MutexInterface> = new Map()
	static counter_lock = withTimeout(new Mutex(), 5000)
	static shard_id = -1

	constructor() {
		Main.bot_version = process.argv[2] || 'alpha'

		this.client = new Client({
			makeCache: Options.cacheWithLimits({
				...Options.DefaultMakeCacheSettings,
				ReactionManager: 0,
				GuildMemberManager: {
					maxSize: 200,
					keepOverLimit: member => member.id === this.client.user.id,
				},
			}),
			sweepers: {
				messages: {
					interval: 1 * 60,
					lifetime: 5 * 60
				},
				users: {
					interval: 3_600, // Every hour.
					filter: () => user => user.bot && user.id !== user.client.user.id, // Remove all bots.
				},
			}, intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages], partials: [Partials.Channel],
			waitGuildTimeout: 5000
		});
	}
	// ------------------------------ //
	// ---------- COMMAND HANDLERS ---------- //
	async run() {
		const token = process.env.DISCORD_TOKEN;
		if (!token) {
			throw new Error('DISCORD_TOKEN environment variable is not set');
		}

		// Launch Discord client
		//This is not in the try/catch so the bot restarts
		await this.client.login(token).catch((err) => {
			console.log("Error while logging in: " + err);
			if (err.code.includes("TokenInvalid")) {
				parentPort.postMessage({ type: "token_invalid" })
			}
		});

		//Parse & build the card database
		const parser = new CardParser()
		this.gacha = new GachaManager(parser.mapRewards(rewardsRawData), parser.mapRarities(raritiesRawData).reverse())

		//Load & connect to DB
		this.dataManager = sharedDatabase;

		// Logging
		this.client.once(Events.ClientReady, async () => {
			this.client.user.setActivity({ name: 'Restarting ...', type: ActivityType.Watching })

			// Check shard ID to launch the auction watcher
			parentPort.on("message", async (message: PortMessage) => {
				if (!message.type) return false;

				if (message.type == "shardId") {
					Main.shard_id = (message.data.shardId + 1)

					this.logger = createLogger({
						level: 'info',
						exitOnError: false,
						format: format.json(),
						transports: [
							new transports.File({ filename: "logs/shard" + Main.shard_id + ".log" }),
						],
					});
					this.cmd_logger = createLogger({
						level: 'info',
						exitOnError: false,
						format: format.json(),
						transports: [
							new DailyRotateFile({
								filename: "logs/commands-shard" + Main.shard_id + "-%DATE%.log",
								datePattern: 'YYYY-MM-DD-HH',
								maxFiles: '7d'
							}),
						],
					});
				} else {
					try {
						switch (message.type) {
							case 'sendMessage': {
								const { userId, embed } = message.data;
								const user = await this.client.users.fetch(userId);
								const embed_djs = new Discord.EmbedBuilder()
									.setColor(embed.color)
									.setDescription(embed.description)

								user.send({ embeds: [embed_djs] }).catch(() => { });
								break;
							}
							default:
								console.log(`Received unknown message type: ${message.type}`);
						}
					} catch (err) {
						this.logger.error("parentPort", { message: err, timestamp: moment().format("YYYY-MM-DD HH:mm:ss") })
					}
				}
				return true;
			});

			//Load slash commands
			const commandFiles = fs.readdirSync(path.resolve(__dirname, 'commands')).filter(file => file.endsWith('.ts') || file.endsWith('.js'))

			const json_commands = []
			this.slashCommands = new Collection();
			for (const file of commandFiles) {
				const commandModule = await import(`./commands/${file}`);
				const command = commandModule.default || commandModule; // Handle default exports if necessary

				if (!command.data || !command.data.name || command.data.name == "template_debug") {
					continue;
				}
				this.all_slash_commands.push(command.data.name)
				this.slashCommands.set(command.data.name, command);
				json_commands.push(command.data.toJSON());
			}

			const activities = [
				'Listening to WJSN 👑',
				'Looking at WJSN cards 👀',
				'Streaming Last Sequence 🎶',
				'Streaming UNNATURAL 🎶',
				'Watching Queendom Puzzle 🧩',
				'Watching WJSN vlogs 📺',
				'Bidding on WJSN cards 💎',
				'Crafting WJSN cards 🎴',
				'Hitting the WJSN piñata 🪅',
				'Gachaing WJSN cards 🎰',
				'Side-eyeing the other bots 😶‍🌫️'
			]
			this.client.user.setActivity({ name: activities[0], type: ActivityType.Custom })
			setInterval(() => {
				const activity = activities[Math.floor(Math.random() * activities.length)]
				this.client.user.setActivity({ name: activity, type: ActivityType.Custom })
			}, 60000 * 15)

			//onInteractionCreate
			try {
				this.client.on(Events.InteractionCreate, interaction => {
					//START OF RECEIVING AN INTERACTION
					if (!interaction.isChatInputCommand()) return;

					try {
						if (this.dataManager === null) {
							return
						} else {
							this.respondToSlashCommands(interaction).catch(err => {
								this.logger.error("catchAll", { message: err, timestamp: moment().format("YYYY-MM-DD HH:mm:ss") })
							})
						}
					} catch (err) {
						this.logger.error("innerTry", { message: err, timestamp: moment().format("YYYY-MM-DD HH:mm:ss") })
					}
				})
			} catch (err) {
				this.logger.error("interactionCreate", { message: err, timestamp: moment().format("YYYY-MM-DD HH:mm:ss") })
			}
		})
	}
	async respondToSlashCommands(interaction: Discord.ChatInputCommandInteraction) {
		if (!interaction) return;
		if (interaction.user.bot) {
			return
		}
		if (!interaction.channel) {
			return
		}
		if (!interaction.isCommand()) {
			return
		}

		if (interaction.guild && !interaction.channel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.SendMessages)) {
			return
		}
		if (interaction.guild && !interaction.channel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.ViewChannel)) {
			return
		}
		if (interaction.guild && !interaction.channel.permissionsFor(interaction.guild.members.me).has(PermissionsBitField.Flags.EmbedLinks)) {
			return
		}

		const command = interaction.commandName;

		if (!this.all_slash_commands.includes(command)) {
			return
		}

		try {
			await interaction.deferReply() // Feel free to remove this

			const user = await this.dataManager.getUser(interaction.user.id)
			if (user == null) {
				await this.dataManager.addUser(interaction.user.id, interaction.user.username)
				const msg = new Discord.EmbedBuilder()
					.setColor("#2ecc71")
					.setDescription("`🥳` Welcome to eunseo-base !\n\nRun **/help** to learn how to play.\nYou can also read the bot rules with **/rules**.\nPlease note that on this bot, alting is forbidden and will lead to bans.")

				Channel.replyAnother(interaction, msg, interaction.user)
				await this.execSlash(interaction, user);
			} else {
				if (!user["banned"]) {
					this.cmd_logger.log({ level: 'info', message: interaction.commandName, timestamp: moment().format("YYYY-MM-DD HH:mm:ss") })
					await this.execSlash(interaction, user)
					const timestamp_minute = moment().format("YYYY-MM-DD HH:mm")
					Main.counter_lock.runExclusive(async () => {
						if (timestamp_minute != Main.this_minute_timestamp && Main.bot_version == "production") {
							Main.this_minute_timestamp = timestamp_minute
							Main.this_minute_counter = 0
						} else {
							Main.this_minute_counter += 1
						}
					}).catch(err => {
						this.logger.error("countInteractions", { message: err, timestamp: moment().format("YYYY-MM-DD HH:mm:ss") })
					})
				} else {
					Channel.replyNegative(interaction, "You're banned from the bot.")
					return
				}
			}
		} catch (err) {
			const error_msg = interaction.commandId + " " + interaction.commandName + " " + err
			this.logger.error("getUser", { message: error_msg, timestamp: moment().format("YYYY-MM-DD HH:mm:ss") })
		}
	}
	async execSlash(interaction: Discord.ChatInputCommandInteraction, user: User) {
		if (!user) return;

		//Generate mutex if doesn't exist
		if (!Main.slash_locks.has(user.id)) {
			Main.slash_locks.set(user.id, new Mutex())
		}

		//Check slowmode / mutex
		const slowmode = await this.dataManager.getSlowmode()
		tryAcquire(Main.slash_locks.get(user.id)).acquire().then(async (release) => {
			try {
				const command = this.slashCommands.get(interaction.commandName);
				if (!command) return;

				//Run the slash command
				try {
					const t0 = performance.now()
					command.execute(interaction, user, this.dataManager, this.gacha, this.client).then(() => {
						const t1 = performance.now()
						// console.log((t1 - t0).toFixed(2) + " ms - " + interaction.commandName)
						const remaining_slowmode = slowmode - (t1 - t0)
						if (remaining_slowmode > 0) {
							this.releaseAfterCooldown(release, remaining_slowmode)
						} else {
							release()
						}
					}).catch((err: Error) => {
						this.logger.error("exec " + interaction.commandName, { message: err, timestamp: moment().format("YYYY-MM-DD HH:mm:ss") })
						this.releaseAfterCooldown(release, slowmode)
					})
				} catch (err) {
					this.logger.error("runCatch " + interaction.commandName, { message: err, timestamp: moment().format("YYYY-MM-DD HH:mm:ss") })
					this.releaseAfterCooldown(release, slowmode)
					await interaction.editReply({ content: 'Sorry, there was an error while executing this command !' }).catch();
				}

			} catch (err) {
				this.logger.error("acquire", { message: err, timestamp: moment().format("YYYY-MM-DD HH:mm:ss") })
				this.releaseAfterCooldown(release, slowmode)
			}
		}).catch(() => {
			if (slowmode <= 3000) {
				Channel.replyNegative(interaction, "Please wait at least a few seconds before using another command !")
			}
		})
	}
	releaseAfterCooldown(release: MutexInterface.Releaser, slowmode: number) {
		setTimeout(() => {
			release()
		}, slowmode);
	}
}

//Run the bot
const bot = new Main()
void bot.run()
