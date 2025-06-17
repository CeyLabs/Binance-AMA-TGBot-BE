import { Injectable } from "@nestjs/common";
import { Context, Markup } from "telegraf";
import { Action, Command, Update } from "nestjs-telegraf";

@Update()
@Injectable()
export class NewAMAService {
  constructor() {}

  @Command("newama")
  async handleNewAMACommand(ctx: Context): Promise<void> {
    const text = ctx.text

    if (!text) {
      ctx.reply("Invalid command format.");
      return;
    }

    // Remove the command part and parse the rest
    const argsText = text.replace(/^\/newama\s+/, "");

    // Match: 1) language, 2) AMA number, 3) AMA name in quotes
    const match = argsText.match(/^(\w+)\s+(\d+)\s+"(.+)"$/);

    if (!match) {
      ctx.reply(
        '❌ Incorrect format.\n\n✅ Correct usage:\n`/newama <language> <number> "<AMA name>"`\n\n📌 Example:\n`/newama en 50 "AMA Title"`'
      );
      return;
    }

    const [, language, amaNumber, amaName] = match;

    // Build the AMA message
    const message = `
📢 <b>Binance MENA Weekly AMA #${amaNumber}</b>

Join us for an exciting session to discuss <b>${amaName}</b>.

✅ <b>How to Participate:</b>
Ask your questions in this group using the below hashtag:

<pre>#weeklysession${amaNumber}</pre>

🏆 The best questions will share the rewards! Get your questions ready!
    `;

    // Send the message
    await ctx.replyWithHTML(
      message.trim(),
      Markup.inlineKeyboard([
        Markup.button.callback("📤 Publish AMA", `publish_ama_${amaNumber}`),
      ])
    );
  }

  @Action(/publish_ama_(\d+)/)
  async handlePublishAMA(ctx: Context) {
    const callbackQuery = ctx.callbackQuery as any;
    const match = callbackQuery.data.match(/publish_ama_(\d+)/);
    if (!match) return;
    const amaNumber = parseInt(match[1], 10);
    await ctx.answerCbQuery(`✅ AMA ${amaNumber} published!`);
  }
}
