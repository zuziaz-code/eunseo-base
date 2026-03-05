import 'dotenv/config';
import { ShardEvents, ShardingManager } from 'discord.js'
import moment from 'moment';

import process from "process";
import { Auction } from './auction';
import { GachaManager } from './gachamanager';
import { CardParser } from './utils/cardparser';
import raritiesRawData from "../data/rarities.json"
import rewardsRawData from "../data/cards.json";
import { sharedDatabase } from './core/sharedDatabase';

export class Launcher {
    async launch() {
        //Parsing command line args
        const args = process.argv.slice(2),
            bot_version = args[0] || 'alpha';

        const token = process.env.DISCORD_TOKEN;
        if (!token) {
            process.exit(1)
        }

        const nb_shards = (bot_version != "production") ? 2 : "auto";
        const BOT_FILE_PATH = "built/bot/shard.js";

        const sharder = new ShardingManager(BOT_FILE_PATH, {
            token: token,
            mode: "worker",
            totalShards: nb_shards,
            respawn: false,
            shardArgs: [bot_version]
        });

        const last_ping_for_shard = new Map();

        sharder.on("shardCreate", shard => {
            shard.on(ShardEvents.Ready, () => {
                shard.worker.postMessage({ type: "shardId", data: { shardId: shard.id } });
                last_ping_for_shard.set(shard.id, moment());
            });
            shard.on(ShardEvents.Message, message => {
                if (message.type === "token_invalid") {
                    console.log(`Shard ${shard.id} encountered a TokenInvalid error. Stopping all shards...`);
                    // Disable shard respawning
                    sharder.respawn = false;
                    // Kill all shards and exit the main process
                    void sharder.broadcastEval(_c => { throw new Error("TokenInvalid") });
                    process.exit(2);
                }
            });
            shard.on(ShardEvents.Error, (error) => {
                console.log(error);
            });
        });
        await sharder.spawn({
            timeout: 30000
        })

        const dataManager = sharedDatabase;
        const parser = new CardParser()
        const gacha = new GachaManager(parser.mapRewards(rewardsRawData), parser.mapRarities(raritiesRawData).reverse())
        const target_shard_size = 10

        async function manageAuctions() {
            const maintenance = await dataManager.getToggle("freeze_auctions")
            const disable_auctions = await dataManager.getToggle("disable_auctions")
            if (!maintenance && !disable_auctions) {
                const hasLock = await dataManager.acquireLock();
                if (!hasLock) {
                    return;
                }
                if (sharder.shards.size < target_shard_size) {
                    console.log('Less than ' + target_shard_size + ' shards are currently active, skipping this iteration...');
                } else {
                    const auctions = await dataManager.getAllAuctions({})
                    const auctions_to_close = [] as Auction[]
                    for (const auction of auctions) {
                        if (auction.isFinished()) {
                            auctions_to_close.push(auction)
                        }
                    }
                    let i = 0
                    for (const auction of auctions_to_close) {
                        await auction.closeAuction(dataManager, gacha, sharder.shards.get(i))
                        i++;
                        if (i >= target_shard_size) {
                            i = 0
                        }
                    }
                }
                await dataManager.releaseLock();
            }
            setTimeout(manageAuctions, 30000);
        }

        if (bot_version == "production") {
            await dataManager.releaseLock();

            console.log("[managers] Auction manager started !")
            setTimeout(manageAuctions, 30000);
        }
    }
}

const bot_launcher = new Launcher();
void bot_launcher.launch();