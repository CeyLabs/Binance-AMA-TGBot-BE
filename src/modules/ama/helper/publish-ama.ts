import { Context } from "telegraf";
import { generateAMAMessage } from "./message";
import { AMA_HASHTAG } from "../ama.constants";

export async function handlePublishAMA(
  ctx: Context,
  adminGroupId: string,
  publicGroupId: string,
  createAMA: (
    amaNumber: number,
    amaName: string,
    topicId: number
  ) => Promise<void>
): Promise<void> {
  const callbackQuery = ctx.callbackQuery as any;
  const match = callbackQuery.data.match(/publish_ama_(\d+)_(.+)/);
  if (!match) return;

  const amaNumber = parseInt(match[1], 10);
  const amaName = decodeURIComponent(match[2]);

  // Create forum topic
  const topic = await ctx.telegram.callApi("createForumTopic", {
    chat_id: adminGroupId,
    name: `#${amaNumber} - ${amaName}`,
  });

  // Insert AMA details into the database
  await createAMA(amaNumber, amaName, topic.message_thread_id);

  const message = generateAMAMessage(amaNumber, amaName);
  await ctx.telegram.sendMessage(publicGroupId, message, {
    parse_mode: "HTML",
  });
}
