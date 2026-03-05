import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, ChatInputCommandInteraction } from "discord.js";


export class Pages {
  static paginateSlash = async (custom_ids: string[], interaction: ChatInputCommandInteraction, pages: EmbedBuilder[], buttonList: ButtonBuilder[], timeout = 60000, author_id: string, footer: string = "") => {
    if (!pages) throw new Error("Pages are not given.");
    if (!buttonList) throw new Error("Buttons are not given.");
    if (buttonList.length !== 2) throw new Error("Need two buttons.");

    let page = 0;

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttonList);
    const curPage = await interaction.editReply({
      embeds: [pages[page].setFooter({ text: `Page ${page + 1} / ${pages.length} ` + footer })],
      components: [row]
    }).catch(() => {
      return
    });

    if (!curPage) {
      return
    }

    const filter = (i:any) => (i.customId === custom_ids[0] || i.customId === custom_ids[1]) && i.user.id === author_id;

    try {
      const collector = curPage.createMessageComponentCollector({
        filter,
        time: timeout,
      })

      collector.on("collect", async (i) => {
        try {
          await i.deferUpdate();
          switch (i.customId) {
            case custom_ids[0]:
              page = page > 0 ? --page : pages.length - 1;
              break;
            case custom_ids[1]:
              page = page + 1 < pages.length ? ++page : 0;
              break;
            default:
              break;
          }
          await i.editReply({
            embeds: [pages[page].setFooter({ text: `Page ${page + 1} / ${pages.length} ` + footer })],
            components: [row],
          });
          collector.resetTimer();
        } catch { }
      });

      collector.on("end", () => {
        const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          buttonList[0].setDisabled(true),
          buttonList[1].setDisabled(true)
        );
        curPage.edit({
          embeds: [pages[page].setFooter({ text: `Page ${page + 1} / ${pages.length} ` + footer })],
          components: [disabledRow],
        }).catch(() => { });
      });
    } catch { }
  };
}