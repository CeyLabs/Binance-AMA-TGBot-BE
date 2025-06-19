import { Context } from "telegraf";
import { AMA_COMMANDS, AMA_HASHTAG } from "../ama.constants";
import { AMA } from "../types";

export async function handleStartAMA(
  ctx: Context,
  adminGroupId: string,
  updateAMA: (sessionNo: number, data: Partial<AMA>) => Promise<boolean>
): Promise<void> {
  const text = ctx.text;
  if (!text) {
    await ctx.reply("Invalid command format.");
    return;
  }
  // Parse the command arguments
  const argsText = text.replace(new RegExp(`^/${AMA_COMMANDS.START}\\s+`), "");
  const match = argsText.match(/^(\d+)/);
  if (!match) {
    await ctx.reply("Invalid command format. Use: /startama <sessionNo>");
    return;
  }
  const sessionNo = parseInt(match[1], 10);
  if (isNaN(sessionNo) || sessionNo <= 0) {
    await ctx.reply("Invalid session number. Please provide a valid number.");
    return;
  }

  // Create a new AMA session topic in the admin group
  const thread = await ctx.telegram.callApi("createForumTopic", {
    chat_id: adminGroupId,
    name: `#${sessionNo} AMA Session`,
  });

  // Update the thread ID in the AMA session
  await updateAMA(sessionNo, {
    thread_id: thread.message_thread_id,
    status: "active",
  });

  await ctx.reply(`#${AMA_HASHTAG}${sessionNo} has started!`);
  await ctx.reply(
    "Binance AMA Bot is listening to the messages in Binance MENA group."
  );
}
