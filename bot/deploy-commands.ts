import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { REST, Routes } from 'discord.js';

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // optional: for guild-only deploy

if (!TOKEN || !CLIENT_ID) {
	console.error('Missing DISCORD_TOKEN or CLIENT_ID in .env');
	process.exit(1);
}

async function main() {
	const commandsDir = path.resolve(__dirname, 'commands');
	const commandFiles = fs.readdirSync(commandsDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));

	const commands = [];
	for (const file of commandFiles) {
		const mod = await import(`./commands/${file}`);
		const command = mod.default || mod;

		if (!command.data?.name || command.data.name === 'template_debug') continue;

		commands.push(command.data.toJSON());
	}

	const rest = new REST().setToken(TOKEN);

	const route = GUILD_ID
		? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
		: Routes.applicationCommands(CLIENT_ID);

	console.log(`Deploying ${commands.length} commands ${GUILD_ID ? `to guild ${GUILD_ID}` : 'globally'}...`);

	const data = await rest.put(route, { body: commands }) as unknown[];
	console.log(`Successfully registered ${data.length} commands.`);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
