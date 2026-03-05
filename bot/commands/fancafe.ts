/* eslint-disable default-case */
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { User } from '../user';
import { Database } from '../database';
import { GachaManager } from '../gachamanager';
import { Channel } from '../core/channel';
import { FancafeCanvasGenerator } from '../utils/fancafeCanvas';

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fancafe')
        .setDescription('Manage your personal card fancafe')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create your fancafe (one-time setup)')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View your fancafe shelves')
                .addUserOption(option => 
                    option.setName('user')
                    .setDescription('View another user\'s fancafe')
                    .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('shelf')
                .setDescription('Manage your shelves')
                .addStringOption(option =>
                    option.setName('action')
                    .setDescription('What to do with shelves')
                    .setRequired(true)
                    .addChoices(
                        { name: 'add', value: 'add' },
                        { name: 'remove', value: 'remove' },
                        { name: 'list', value: 'list' },
                        { name: 'rename', value: 'rename' },
                        { name: 'color', value: 'color' },
                        { name: 'border-color', value: 'border-color' }
                    )
                )
                .addStringOption(option =>
                    option.setName('name')
                    .setDescription('Name for the new shelf (for add action)')
                    .setRequired(false)
                )
                .addNumberOption(option =>
                    option.setName('shelf_number')
                    .setDescription('Shelf number (for remove/rename/color actions)')
                    .setRequired(false)
                    .setMinValue(1)
                    .setMaxValue(3)
                )
                .addStringOption(option =>
                    option.setName('color')
                    .setDescription('Hex color code (e.g. #8B00FF) - for shelf visuals or border')
                    .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('card')
                .setDescription('Manage cards on your shelves')
                .addStringOption(option =>
                    option.setName('action')
                    .setDescription('What to do with cards')
                    .setRequired(true)
                    .addChoices(
                        { name: 'add', value: 'add' },
                        { name: 'remove', value: 'remove' },
                        { name: 'replace', value: 'replace' }
                    )
                )
                .addNumberOption(option =>
                    option.setName('shelf_number')
                    .setDescription('Which shelf (1-3)')
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(3)
                )
                .addStringOption(option =>
                    option.setName('card_ids')
                    .setDescription('ID(s) of the card(s) - can be multiple IDs separated by spaces')
                    .setRequired(true)
                )
                .addNumberOption(option =>
                    option.setName('position')
                    .setDescription('Position on shelf (1-5, for replace/remove)')
                    .setRequired(false)
                    .setMinValue(1)
                    .setMaxValue(5)
                )
        ),

    async execute(interaction: ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
            case 'create':
                await this.handleCreate(interaction, user, dataManager);
                break;
            case 'view':
                await this.handleView(interaction, user, dataManager, gacha);
                break;
            case 'shelf':
                await this.handleShelf(interaction, user, dataManager);
                break;
            case 'card':
                await this.handleCard(interaction, user, dataManager, gacha);
                break;
        }
    },

    async handleCreate(interaction: ChatInputCommandInteraction, user: User, dataManager: Database) {
        const existingFancafe = await dataManager.getFancafe(user.id);
        
        if (existingFancafe) {
            Channel.replyNegative(interaction, "You already have a fancafe! Use `/fancafe view` to see it.");
            return;
        }

        // Check if user has enough gems
        const creationCost = 10000;
        if (user.gems < creationCost) {
            Channel.replyNegative(interaction, 
                `Creating a fancafe costs **${creationCost.toLocaleString()} 💎**\n` +
                `You currently have **${user.gems.toLocaleString()} 💎**\n` +
                `You need **${(creationCost - user.gems).toLocaleString()} 💎** more!`
            );
            return;
        }

        // Create confirmation embed and buttons
        const confirmEmbed = new EmbedBuilder()
            .setColor(0x8B00FF)
            .setTitle('🏠 Create Your Fancafe')
            .setDescription(
                `Are you sure you want to create your personal fancafe?\n\n` +
                `**Cost:** ${creationCost.toLocaleString()} 💎\n` +
                `**Your Balance:** ${user.gems.toLocaleString()} 💎\n` +
                `**Remaining:** ${(user.gems - creationCost).toLocaleString()} 💎\n\n` +
                `A fancafe allows you to:\n` +
                `• Display your favorite cards\n` +
                `• Create up to 3 custom shelves\n` +
                `• Show off your collection to others`
            )
            .setFooter({ text: 'This action cannot be undone!' });

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('fancafe_create_confirm')
                    .setLabel('Confirm (10,000 💎)')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('fancafe_create_cancel')
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

        const response = await interaction.editReply({
            embeds: [confirmEmbed],
            components: [row]
        });

        // Wait for user confirmation
        const filter = (i: any) => i.user.id === interaction.user.id;
        const collector = response.createMessageComponentCollector({ filter, time: 60000, max: 1 });

        collector.on('collect', async (i: any) => {
            if (i.customId === 'fancafe_create_confirm') {
                // Double-check they still have enough gems
                const updatedUser = await dataManager.getUser(user.id);
                if (!updatedUser || updatedUser.gems < creationCost) {
                    await i.update({
                        content: `You no longer have enough gems to create a fancafe!`,
                        embeds: [],
                        components: []
                    });
                    return;
                }

                // Deduct gems and create fancafe
                await dataManager.addGems(user.id, -creationCost);
                await dataManager.createFancafe(user.id);
                
                await i.update({
                    content: "🎉 Your fancafe has been created!\n\n" +
                        `You spent **${creationCost.toLocaleString()} 💎** to establish your fancafe.\n\n` +
                        "You start with one free shelf called 'Featured Collection'.\n" +
                        "• Use `/fancafe shelf add [name]` to add more shelves (max 3)\n" +
                        "• Use `/fancafe card add [shelf] [card_id]` to add cards\n" +
                        "• Use `/fancafe view` to see your fancafe",
                    embeds: [],
                    components: []
                });
            } else {
                await i.update({
                    content: 'Fancafe creation cancelled.',
                    embeds: [],
                    components: []
                });
            }
        });

        collector.on('end', async (collected) => {
            if (collected.size === 0) {
                await interaction.editReply({
                    content: 'Fancafe creation timed out.',
                    embeds: [],
                    components: []
                });
            }
        });
    },

    async handleView(interaction: ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
        
        // Get target user (self or another user)
        const targetUser = interaction.options?.getUser('user') || interaction.user;
        const targetUserId = targetUser.id;
        const isOwnFancafe = targetUserId === user.id;

        // Get fancafe data
        const fancafe = await dataManager.getFancafe(targetUserId);
        
        if (!fancafe) {
            if (isOwnFancafe) {
                await interaction.editReply({
                    content: "You don't have a fancafe yet! Use `/fancafe create` to start your collection."
                });
            } else {
                await interaction.editReply({
                    content: "This user doesn't have a fancafe yet."
                });
            }
            return;
        }

        try {
            // Get user data for display
            const targetUserData = await dataManager.getUser(targetUserId);
            if (!targetUserData) {
                await interaction.editReply({
                    content: "Could not load user data."
                });
                return;
            }

            // Prepare shelves data with card URLs
            const shelves = await Promise.all(fancafe.shelves.map((shelf: any) => {
                const cardUrls = shelf.cards.map((cardId: number) => {
                    const card = gacha.getCardById(cardId);
                    return card ? card.image : null;
                });

                // Filter out null values
                const validUrls = cardUrls.filter((url: string | null) => url !== null);

                return {
                    name: shelf.name,
                    cardUrls: validUrls,
                    // Only use custom color if user has active premium
                    color: shelf.color,
                    // Border color is available to everyone
                    borderColor: shelf.borderColor
                };
            }));

            // Check if all shelves are empty
            const totalCards = fancafe.shelves.reduce((sum: number, shelf: any) => sum + shelf.cards.length, 0);
            
            if (totalCards === 0) {
                // Show empty state with shelf list
                let shelfList = "\n**Your shelves:**\n";
                fancafe.shelves.forEach((shelf: any, index: number) => {
                    shelfList += `${index + 1}. ${shelf.name} (0/5 cards)\n`;
                });
                
                const emptyEmbed = new EmbedBuilder()
                    .setColor(0x8B00FF)
                    .setTitle(`🏠 ${targetUserData.name}'s Fancafe`)
                    .setDescription(
                        isOwnFancafe 
                            ? `Your fancafe is ready but empty!${shelfList}\n💡 **Get started:**\n• Use \`/fancafe card add [shelf] [card_id]\` to add cards\n• Use \`/fancafe shelf add [name]\` to create more shelves (max 3)\n• Use \`/fancafe shelf rename\` to rename shelves`
                            : "This fancafe is empty."
                    )

                await interaction.editReply({ embeds: [emptyEmbed] });
                return;
            }
            
            // Separate empty and non-empty shelves
            const nonEmptyShelves = shelves.filter(shelf => shelf.cardUrls.length > 0);

            // Preload all unique images for better performance
            if (nonEmptyShelves.length > 0) {
                const allUrls = [...new Set(nonEmptyShelves.flatMap((shelf: any) => shelf.cardUrls))];
                await FancafeCanvasGenerator.preloadImages(allUrls);
            }
            
            // Generate shelf images for non-empty shelves
            const attachments = nonEmptyShelves.length > 0 
                ? await FancafeCanvasGenerator.generateFancafeShelves(nonEmptyShelves)
                : [];

            // Create main embed
            // Use first shelf's color if available and user has premium, otherwise default purple
            const firstShelfColor = fancafe.shelves[0]?.color
                ? parseInt(fancafe.shelves[0].color.replace('#', ''), 16)
                : 0x8B00FF;

            const mainEmbed = new EmbedBuilder()
                .setColor(firstShelfColor)
                .setTitle(`🏠 ${targetUserData.name}'s Fancafe`)
                .setDescription(
                    `**Welcome to ${isOwnFancafe ? 'your' : `${targetUserData.name}'s`} fancafe!**\n` +
                    (isOwnFancafe ? '\n💡 **Tips:**\n' +
                    '• Use `/fancafe card add` to add cards\n' +
                    '• Use `/fancafe shelf add` to create new shelves\n' +
                    '• Each shelf can hold up to 5 cards' : '')
                )

            // Create embeds for all shelves
            const allShelfEmbeds: EmbedBuilder[] = [];
            let attachmentIndex = 0;
            
            // Process shelves in original order
            for (const originalShelf of fancafe.shelves) {
                const shelfData = shelves.find((s: any) => s.name === originalShelf.name);

                if (shelfData && shelfData.cardUrls.length > 0) {
                    // Non-empty shelf with image
                    // Use shelf color for the embed (premium feature), otherwise default purple
                    const embedColor = shelfData.color
                        ? parseInt(shelfData.color.replace('#', ''), 16)
                        : 0x8B00FF;
                    const embed = new EmbedBuilder()
                        .setColor(embedColor)
                        .setImage(`attachment://${attachments[attachmentIndex].name}`);
                    allShelfEmbeds.push(embed);
                    attachmentIndex++;
                } else {
                    // Empty shelf
                    // Use shelf color if premium, otherwise dark gray
                    const shelfColor = originalShelf.color
                        ? parseInt(originalShelf.color.replace('#', ''), 16)
                        : 0x23272A;
                    
                    const emptyEmbed = new EmbedBuilder()
                        .setColor(shelfColor)
                        .setTitle(`📚 ${originalShelf.name}`)
                        .setDescription(
                            isOwnFancafe 
                                ? `*This shelf is empty*\n\nUse \`/fancafe card add ${fancafe.shelves.indexOf(originalShelf) + 1} [card_ids]\` to add cards here.`
                                : `*This shelf is empty*`
                        );
                    allShelfEmbeds.push(emptyEmbed);
                }
            }

            // Send all embeds with attachments
            await interaction.editReply({
                embeds: [mainEmbed, ...allShelfEmbeds],
                files: attachments
            });
        } catch (error) {
            console.error('Error in fancafe view command:', error);
            await interaction.editReply({
                content: 'An error occurred while generating your fancafe display!'
            });
        }
    },

    async handleShelf(interaction: ChatInputCommandInteraction, user: User, dataManager: Database) {
        const action = interaction.options.getString('action', true);
        const fancafe = await dataManager.getFancafe(user.id);

        if (!fancafe) {
            Channel.replyNegative(interaction, "You don't have a fancafe yet! Use `/fancafe create` first.");
            return;
        }

        switch (action) {
            case 'list': {
                let shelfList = "**Your Fancafe Shelves:**\n";
                fancafe.shelves.forEach((shelf: any, index: number) => {
                    const colorInfo = shelf.color ? ` (Shelf Color: ${shelf.color})` : '';
                    const borderInfo = shelf.borderColor ? ` (Border: ${shelf.borderColor})` : '';
                    shelfList += `${index + 1}. **${shelf.name}** - ${shelf.cards.length}/5 cards${colorInfo}${borderInfo}\n`;
                });
                Channel.replyPositive(interaction, shelfList);
                break;
            }

            case 'add': {
                const name = interaction.options.getString('name');
                if (!name) {
                    Channel.replyNegative(interaction, "Please provide a name for the new shelf.");
                    return;
                }

                if (name.length > 30) {
                    Channel.replyNegative(interaction, "Shelf name must be 30 characters or less.");
                    return;
                }

                const success = await dataManager.addFancafeShelf(user.id, name);
                if (success) {
                    Channel.replyPositive(interaction, `Shelf '${name}' has been added to your fancafe!`);
                } else {
                    Channel.replyNegative(interaction, "You already have the maximum of 3 shelves.");
                }
                break;
            }

            case 'remove': {
                const shelfNumber = interaction.options.getNumber('shelf_number');
                if (!shelfNumber) {
                    Channel.replyNegative(interaction, "Please specify which shelf to remove (1-3).");
                    return;
                }

                const shelfIndex = shelfNumber - 1;
                const success = await dataManager.removeFancafeShelf(user.id, shelfIndex);
                if (success) {
                    Channel.replyPositive(interaction, `Shelf #${shelfNumber} has been removed.`);
                } else {
                    Channel.replyNegative(interaction, "Invalid shelf number or you must keep at least one shelf.");
                }
                break;
            }

            case 'rename': {
                const shelfNumber = interaction.options.getNumber('shelf_number');
                const newName = interaction.options.getString('name');
                
                if (!shelfNumber) {
                    Channel.replyNegative(interaction, "Please specify which shelf to rename (1-3).");
                    return;
                }
                
                if (!newName) {
                    Channel.replyNegative(interaction, "Please provide a new name for the shelf.");
                    return;
                }
                
                if (newName.length > 30) {
                    Channel.replyNegative(interaction, "Shelf name must be 30 characters or less.");
                    return;
                }
                
                const shelfIndex = shelfNumber - 1;
                if (shelfIndex < 0 || shelfIndex >= fancafe.shelves.length) {
                    Channel.replyNegative(interaction, "Invalid shelf number.");
                    return;
                }
                
                const oldName = fancafe.shelves[shelfIndex].name;
                fancafe.shelves[shelfIndex].name = newName;
                await dataManager.updateFancafeShelves(user.id, fancafe.shelves);
                Channel.replyPositive(interaction, `Renamed shelf '${oldName}' to '${newName}'!`);
                break;
            }

            case 'color': {
                const shelfNumber = interaction.options.getNumber('shelf_number');
                const color = interaction.options.getString('color');
                
                if (!shelfNumber) {
                    Channel.replyNegative(interaction, "Please specify which shelf to color (1-3).");
                    return;
                }
                
                if (!color) {
                    Channel.replyNegative(interaction, "Please provide a color code (e.g., #8B00FF).");
                    return;
                }
            
                // Validate color format
                const colorRegex = /^#[0-9A-Fa-f]{6}$/;
                if (color !== 'reset' && !colorRegex.test(color)) {
                    Channel.replyNegative(interaction, "Invalid color format. Please use a hex color code like #8B00FF, or 'reset' to default.");
                    return;
                }
                
                const shelfIndex = shelfNumber - 1;
                if (shelfIndex < 0 || shelfIndex >= fancafe.shelves.length) {
                    Channel.replyNegative(interaction, "Invalid shelf number.");
                    return;
                }
                
                if (color === 'reset') {
                    delete fancafe.shelves[shelfIndex].color;
                    await dataManager.updateFancafeShelves(user.id, fancafe.shelves);
                    Channel.replyPositive(interaction, `Reset shelf visual color for '${fancafe.shelves[shelfIndex].name}' to default!`);
                } else {
                    fancafe.shelves[shelfIndex].color = color;
                    await dataManager.updateFancafeShelves(user.id, fancafe.shelves);
                    Channel.replyPositive(interaction, `Set shelf visual color for '${fancafe.shelves[shelfIndex].name}' to ${color}!`);
                }
                break;
            }

            case 'border-color': {
                const shelfNumber = interaction.options.getNumber('shelf_number');
                const color = interaction.options.getString('color');

                if (!shelfNumber) {
                    Channel.replyNegative(interaction, "Please specify which shelf to set the border color for (1-3).");
                    return;
                }

                if (!color) {
                    Channel.replyNegative(interaction, "Please provide a color code (e.g., #8B00FF).");
                    return;
                }

                // Validate color format
                const colorRegex = /^#[0-9A-Fa-f]{6}$/;
                if (color !== 'reset' && !colorRegex.test(color)) {
                    Channel.replyNegative(interaction, "Invalid color format. Please use a hex color code like #8B00FF, or 'reset' to default.");
                    return;
                }

                const shelfIndex = shelfNumber - 1;
                if (shelfIndex < 0 || shelfIndex >= fancafe.shelves.length) {
                    Channel.replyNegative(interaction, "Invalid shelf number.");
                    return;
                }

                if (color === 'reset') {
                    delete fancafe.shelves[shelfIndex].borderColor;
                    await dataManager.updateFancafeShelves(user.id, fancafe.shelves);
                    Channel.replyPositive(interaction, `Reset border color for shelf '${fancafe.shelves[shelfIndex].name}' to default purple!`);
                } else {
                    fancafe.shelves[shelfIndex].borderColor = color;
                    await dataManager.updateFancafeShelves(user.id, fancafe.shelves);
                    Channel.replyPositive(interaction, `Set border color for shelf '${fancafe.shelves[shelfIndex].name}' to ${color}!`);
                }
                break;
            }
        }
    },

    async handleCard(interaction: ChatInputCommandInteraction, user: User, dataManager: Database, gacha: GachaManager) {
        const action = interaction.options.getString('action', true);
        const shelfNumber = interaction.options.getNumber('shelf_number', true);
        const cardIdsString = interaction.options.getString('card_ids', true);
        const position = interaction.options.getNumber('position');

        const fancafe = await dataManager.getFancafe(user.id);
        if (!fancafe) {
            Channel.replyNegative(interaction, "You don't have a fancafe yet! Use `/fancafe create` first.");
            return;
        }

        const shelfIndex = shelfNumber - 1;
        if (shelfIndex < 0 || shelfIndex >= fancafe.shelves.length) {
            Channel.replyNegative(interaction, "Invalid shelf number.");
            return;
        }

        const shelf = fancafe.shelves[shelfIndex];
        const inventory = await dataManager.getInventory(user.id);

        switch (action) {
            case 'add': {
                // Parse multiple card IDs
                const cardIds = cardIdsString.split(/\s+/).map(id => parseInt(id)).filter(id => !isNaN(id));
                
                if (cardIds.length === 0) {
                    Channel.replyNegative(interaction, "Please provide valid card ID(s). Use numbers separated by spaces.");
                    return;
                }

                // Check available space
                const availableSpace = 5 - shelf.cards.length;
                if (availableSpace === 0) {
                    Channel.replyNegative(interaction, "This shelf is full (max 5 cards).");
                    return;
                }

                const addedCards: string[] = [];
                const errors: string[] = [];
                let addedCount = 0;

                for (const cardId of cardIds) {
                    // Stop if shelf is full
                    if (shelf.cards.length >= 5) {
                        if (addedCount > 0) {
                            errors.push(`Shelf full after adding ${addedCount} card(s)`);
                        }
                        break;
                    }

                    const card = gacha.getCardById(cardId);

                    // Validation checks
                    if (!card) {
                        errors.push(`Card #${cardId} not found`);
                        continue;
                    }

                    if (!inventory.includes(cardId)) {
                        errors.push(`You don't own ${card.name} (#${cardId})`);
                        continue;
                    }

                    if (card.type === 'legendary' || card.type === 'group-legendary') {
                        errors.push(`${card.name} is legendary and cannot be displayed`);
                        continue;
                    }

                    if (shelf.cards.includes(cardId)) {
                        errors.push(`${card.name} is already on this shelf`);
                        continue;
                    }

                    // Add the card
                    shelf.cards.push(cardId);
                    addedCards.push(card.name);
                    addedCount++;
                }

                if (addedCount > 0) {
                    await dataManager.updateFancafeShelves(user.id, fancafe.shelves);
                    
                    let message = `Added ${addedCount} card(s) to shelf '${shelf.name}':\n`;
                    message += addedCards.map(name => `• **${name}**`).join('\n');
                    
                    if (errors.length > 0) {
                        message += `\n\n⚠️ **Issues:**\n${errors.join('\n')}`;
                    }
                    
                    Channel.replyPositive(interaction, message);
                } else {
                    Channel.replyNegative(interaction, `Could not add any cards:\n${errors.join('\n')}`);
                }
                break;
            }

            case 'remove': {
                const cardId = parseInt(cardIdsString);
                if (isNaN(cardId)) {
                    Channel.replyNegative(interaction, "Please provide a valid card ID for removal.");
                    return;
                }
                
                const pos = position ? position - 1 : shelf.cards.indexOf(cardId);
                
                if (pos < 0 || pos >= shelf.cards.length) {
                    Channel.replyNegative(interaction, "Invalid position or card not found on this shelf.");
                    return;
                }

                const removedCardId = shelf.cards[pos];
                const removedCard = gacha.getCardById(removedCardId);
                shelf.cards.splice(pos, 1);
                
                await dataManager.updateFancafeShelves(user.id, fancafe.shelves);
                Channel.replyPositive(interaction, `Removed **${removedCard?.name || 'card'}** from shelf '${shelf.name}'!`);
                break;
            }

            case 'replace': {
                const cardId = parseInt(cardIdsString);
                if (isNaN(cardId)) {
                    Channel.replyNegative(interaction, "Please provide a valid card ID for replacement.");
                    return;
                }
                
                if (!position) {
                    Channel.replyNegative(interaction, "Please specify the position to replace (1-5).");
                    return;
                }

                const card = gacha.getCardById(cardId);
                
                if (!inventory.includes(cardId)) {
                    Channel.replyNegative(interaction, "You don't own this card.");
                    return;
                }

                if (!card) {
                    Channel.replyNegative(interaction, "Invalid card ID.");
                    return;
                }

                // Check if card is legendary or group-legendary
                if (card.type === 'legendary' || card.type === 'group-legendary') {
                    Channel.replyNegative(interaction, "Legendary cards cannot be displayed in fancafes.");
                    return;
                }

                const pos = position - 1;
                if (pos < 0 || pos >= shelf.cards.length) {
                    Channel.replyNegative(interaction, "Invalid position.");
                    return;
                }

                const oldCard = gacha.getCardById(shelf.cards[pos]);
                shelf.cards[pos] = cardId;
                
                await dataManager.updateFancafeShelves(user.id, fancafe.shelves);
                Channel.replyPositive(interaction, 
                    `Replaced **${oldCard?.name || 'card'}** with **${card.name}** on shelf '${shelf.name}'!`
                );
                break;
            }
        }
    }
};