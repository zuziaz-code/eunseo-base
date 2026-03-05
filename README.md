# Eunseo-Base Bot

This is a ready-to-scale bot "frame" for a Discord card gacha bot. The code was originally used for Eunseo, a kpop gacha card game that formerly reached #10 ranking on top.gg.

## Important note
There's tons of issues, weird patterns and technical debt in this codebase. (It was built when I was still learning code, and that was way before AIs).
I wouldn't actually fork this to create a new bot, but just learn from its structure and create a brand new, cleaner one following discordjs.guide.

Among many problems in this codebase : 
- No mongoose-style layer for Db, but a monolithic database.ts that should've been split
- Commands are deferred by default, which is not how it should be handled
- Weird/inefficient/hard to read loops
- No use of pm2 or similar
- Use of momentjs instead of better libraries
- Some parts may be prone to memory leaks
- Hardcoded strings too often
- Auctions run in the sharder instead of cleaner separated process
- Overall just ugly code in most files I didn't have time to refactor once I actually knew how to code
- Suboptimal shard messaging

It should be alright for small guilds with friends, but probably not for large scale.

## Features

- Card gacha system with rarities and star tiers
- Inventory, wishlist, favorites management
- Card crafting, burning, and selling
- Auction system with bidding
- Daily rewards and work commands
- Fancafe-style card viewer with canvas rendering
- Sharded for multi-guild scaling

## Prerequisites

- Node.js >= 20
- MongoDB instance
- A Discord application with a bot token

## Setup

```bash
npm install
cp .env.example .env   # then fill in your values
```

## Required data files

The `data/` directory is to be filled by yourself. You must provide the following JSON files:

| File | Format |
|---|---|
| `data/cards.json` | `[{ id, name, suffix, group, type, image, stars, era_name, idol_name }]` |
| `data/card_ids.json` | `[{ id, card_code }]` |
| `data/rarities.json` | `[{ name, color, minWeightInverse, stars }]` |
| `data/card_types.json` | `{ "common": "⭐", "event": "🔥", ... }` |

## Running

```bash
# Build
npm run build

# Deploy slash commands globally
npm run deploy

# Start the bot
node built/bot/index.js [version]
```

`version` defaults to `alpha`. Use `production` for auto-sharding.

