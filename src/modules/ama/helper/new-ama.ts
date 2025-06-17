import { Context, Markup } from "telegraf";
import { generateAMAMessage } from "./message";
import { AMA_COMMANDS } from "../ama.constants";

export async function handleNewAMA(ctx: Context): Promise<void> {
  const text = ctx.text;

  if (!text) {
    await ctx.reply("Invalid command format.");
    return;
  }

  const argsText = text.replace(new RegExp(`^/${AMA_COMMANDS.NEW}\\s+`), "");
  const match = argsText.match(/^(\w+)\s+(\d+)\s+"(.+)"$/);

  if (!match) {
    await ctx.reply(
      `❌ Incorrect format.\n\n✅ Correct usage:\n\`/${AMA_COMMANDS.NEW} <language> <number> "<AMA name>"\`\n\n📌 Example:\n\`/${AMA_COMMANDS.NEW} en 50 "AMA Title"\``
    );
    return;
  }

  const [, , amaNumber, amaName] = match;
  const message = generateAMAMessage(amaNumber, amaName);

  await ctx.replyWithHTML(
    message,
    Markup.inlineKeyboard([
      Markup.button.callback(
        "📤 Publish AMA",
        `publish_ama_${amaNumber}_${encodeURIComponent(amaName)}`
      ),
    ])
  );
}
