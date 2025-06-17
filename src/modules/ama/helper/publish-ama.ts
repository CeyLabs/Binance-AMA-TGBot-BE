import { Context } from "telegraf";
import { generateAMAMessage } from "./message";

export async function handlePublishAMA(ctx: Context): Promise<void> {
  const callbackQuery = ctx.callbackQuery as any;
  const match = callbackQuery.data.match(/publish_ama_(\d+)_(.+)/);
  if (!match) return;

  const amaNumber = parseInt(match[1], 10);
  const amaName = decodeURIComponent(match[2]);

  const publicGroupId = process.env.PUBLIC_GROUP_ID;
  if (!publicGroupId) {
    await ctx.answerCbQuery("❌ PUBLIC_GROUP_ID is not set.");
    return;
  }

  if (!process.env.ADMIN_GROUP_ID) {
    throw new Error("ADMIN_GROUP_ID environment variable is not set");
  }

  // Create forum topic
  await ctx.telegram.callApi("createForumTopic", {
    chat_id: process.env.ADMIN_GROUP_ID,
    name: `#${amaNumber} - ${amaName}`,
  });

  // Send the formatted message to public group
  const message = generateAMAMessage(amaNumber, amaName);
  await ctx.telegram.sendMessage(publicGroupId, message, {
    parse_mode: "HTML",
  });
}
