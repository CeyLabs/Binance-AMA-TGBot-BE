import { Context } from "telegraf";
import { generateAMAMessage } from "./message";
import { Knex } from "knex";
import { AMA_TAG } from "../ama.constants";

export async function handlePublishAMA(
  ctx: Context,
  adminGroupId: string,
  publicGroupId: string,
  db: Knex
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
  await db("ama").insert({
    ama_id: amaNumber,
    title: amaName,
    topic_id: topic.message_thread_id,
    tag: `#${AMA_TAG}${amaNumber}`,
  });

  const message = generateAMAMessage(amaNumber, amaName);
  await ctx.telegram.sendMessage(publicGroupId, message, {
    parse_mode: "HTML",
  });
}
