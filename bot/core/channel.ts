import Discord, { EmbedBuilder, MessageFlags } from "discord.js"
import { GUI } from "./gui"

export class Channel {
    static replyAnother(message: Discord.ChatInputCommandInteraction, embed: EmbedBuilder, fallback_user: Discord.User): void {
        try {
            if (message == null || message.channel == null || !message.guild) {
                fallback_user.send({ embeds: [embed] }).catch(() => { })
            } else {
                message.channel.send({ embeds: [embed] }).catch(() => {
                    embed.setFooter({ text: "I had to DM you because I don't have the correct permissions in the channel you played in." })
                    fallback_user.send({ embeds: [embed] }).catch(() => { })
                })
            }
        } catch { }
    }
    static replyAnotherWithMessage(message: Discord.ChatInputCommandInteraction, desc: string, fallback_user: Discord.User): void {
        const msg = new Discord.EmbedBuilder()
            .setDescription(desc)

        Channel.replyAnother(message, msg, fallback_user)
    }
    static reply(message: Discord.ChatInputCommandInteraction, embed: EmbedBuilder): void {
        try {
            // Check if the interaction was deferred
            if (message.deferred || message.replied) {
                message.editReply({ embeds: [embed], components: [] }).catch(() => {
                    message.user.send({ embeds: [embed], components: [] }).catch(() => {
                        //console.error(err)
                    })
                })
            } else {
                // If not deferred, use regular reply
                message.reply({ embeds: [embed], components: [] }).catch(() => {
                    message.user.send({ embeds: [embed], components: [] }).catch(() => {
                        //console.error(err)
                    })
                })
            }
        } catch { }
    }
    static followUp(message: Discord.ChatInputCommandInteraction, embed: EmbedBuilder): void {
        try {
            message.followUp({ embeds: [embed], components: [] }).catch(() => {
                message.reply({ embeds: [embed], components: [] }).catch(() => {
                    message.user.send({ embeds: [embed], components: [] }).catch(() => {
                        //console.error(err)
                    })
                })
            })
        } catch { }
    }
    static replyNegativeAsEphemeral(message: Discord.ChatInputCommandInteraction, desc: string): void {
        try {
            const embed = new Discord.EmbedBuilder()
                .setColor(GUI.COLORS.Error as Discord.ColorResolvable)
                .setDescription(desc)

            void message.reply({ embeds: [embed], components: [], flags: MessageFlags.Ephemeral }).catch(() => {
                message.user.send({ embeds: [embed], components: [] }).catch(() => {
                    //console.error(err)
                })
            }).then(() => {
            })
        } catch { }
    }
    static async replyAsync(message: Discord.ChatInputCommandInteraction, embed: EmbedBuilder) {
        try {
            // Check if the interaction was deferred
            if (message.deferred || message.replied) {
                await message.editReply({ embeds: [embed], components: [] }).catch(async () => {
                    await message.user.send({ embeds: [embed], components: [] }).catch(() => {
                        //console.error(err)
                    })
                })
            } else {
                // If not deferred, use regular reply
                await message.reply({ embeds: [embed], components: [] }).catch(async () => {
                    await message.user.send({ embeds: [embed], components: [] }).catch(() => {
                        //console.error(err)
                    })
                })
            }
        } catch { }
    }

    static replyWithAttach(message: Discord.ChatInputCommandInteraction, embed: Discord.EmbedBuilder, attachment_url: string): void {
        const replyFn = (message.deferred || message.replied) ? 
            (content: any) => message.editReply(content) : 
            (content: any) => message.reply(content);
            
        replyFn({ embeds: [embed], files: [attachment_url] }).catch(() => {
            let error = new Discord.EmbedBuilder()
                .setColor(GUI.COLORS.Error as Discord.ColorResolvable)
                .setDescription("Sorry, Discord blocked this gif for being too large !\nView the gif in your browser by clicking [here](" + attachment_url + ").\n\n*Don't report this as a bug or you will get a warn ! This is a Discord limitation.*")
            replyFn({
                embeds: [error]
            }).catch(() => { })
        })
    }
    static replyPositive(message: Discord.ChatInputCommandInteraction, message_content: string) {
        const msg = new Discord.EmbedBuilder()
            .setColor(GUI.COLORS.Success as Discord.ColorResolvable)
            .setDescription(message_content)

        Channel.reply(message, msg)
    }
    static replyNegative(message: Discord.ChatInputCommandInteraction, reply_content: string) {
        const msg = new Discord.EmbedBuilder()
            .setColor(GUI.COLORS.Error as Discord.ColorResolvable)
            .setDescription(reply_content)

        Channel.reply(message, msg)
    }
    static replyPending(message: Discord.ChatInputCommandInteraction, reply_content: string) {
        const msg = new Discord.EmbedBuilder()
            .setColor(GUI.COLORS.Pending as Discord.ColorResolvable)
            .setDescription(reply_content)

        Channel.reply(message, msg)
    }
    static async replyNegativeAsync(message: Discord.ChatInputCommandInteraction, reply_content: string) {
        const msg = new Discord.EmbedBuilder()
            .setColor(GUI.COLORS.Error as Discord.ColorResolvable)
            .setDescription(reply_content)

        await Channel.replyAsync(message, msg)
    }

}