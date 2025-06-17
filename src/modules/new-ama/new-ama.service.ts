import { Injectable } from "@nestjs/common";
import { Context, Markup } from "telegraf";
import { Action, Command, Update } from "nestjs-telegraf";

@Update()
@Injectable()
export class NewAMAService {
  constructor() {}

  private generateAMAMessage(
    amaNumber: string | number,
    amaName: string
  ): string {
    return `
📢 <b>Binance MENA Weekly AMA #${amaNumber}</b>

Join us for an exciting session to discuss <b>${amaName}</b>.

✅ <b>How to Participate:</b>
Ask your questions in this group using the below hashtag:

<pre>#weeklysession${amaNumber}</pre>

🏆 The best questions will share the rewards! Get your questions ready!
    `.trim();
  }

  @Command("new")
  async handleNewAMACommand(ctx: Context): Promise<void> {
    const text = ctx.text;

    if (!text) {
      await ctx.reply("Invalid command format.");
      return;
    }

    // Remove the command part and parse the rest
    const argsText = text.replace(/^\/new\s+/, "");

    // Match: 1) language, 2) AMA number, 3) AMA name in quotes
    const match = argsText.match(/^(\w+)\s+(\d+)\s+"(.+)"$/);

    if (!match) {
      await ctx.reply(
        '❌ Incorrect format.\n\n✅ Correct usage:\n`/new <language> <number> "<AMA name>"`\n\n📌 Example:\n`/new en 50 "AMA Title"`'
      );
      return;
    }

    const [, , amaNumber, amaName] = match;

    // Build the AMA message
    const message = this.generateAMAMessage(amaNumber, amaName);

    // Send the message
    await ctx.replyWithHTML(
      message.trim(),
      Markup.inlineKeyboard([
        Markup.button.callback(
          "📤 Publish AMA",
          `publish_ama_${amaNumber}_${encodeURIComponent(amaName)}`
        ),
      ])
    );
  }

  @Action(/publish_ama_(\d+)_(.+)/)
  async handlePublishAMA(ctx: Context) {
    const callbackQuery = ctx.callbackQuery as any;
    const match = callbackQuery.data.match(/publish_ama_(\d+)_(.+)/);
    if (!match) return;
    const amaNumber = parseInt(match[1], 10);
    const publicGroupId = process.env.PUBLIC_GROUP_ID;
    const amaName = decodeURIComponent(match[2]);

    if (!publicGroupId) {
      await ctx.answerCbQuery("❌ PUBLIC_GROUP_ID is not set.");
      return;
    }

    if (!process.env.ADMIN_GROUP_ID) {
      throw new Error("ADMIN_GROUP_ID environment variable is not set");
    }

    await ctx.telegram.callApi("createForumTopic", {
      chat_id: process.env.ADMIN_GROUP_ID,
      name: `#${amaNumber} - ${amaName}`,
    });

    const message = this.generateAMAMessage(amaNumber, amaName);
    await ctx.telegram.sendMessage(publicGroupId, message.trim(), {
      parse_mode: "HTML",
    });
  }
}
