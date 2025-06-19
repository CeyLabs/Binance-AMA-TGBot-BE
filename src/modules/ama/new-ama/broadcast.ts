import { Context } from "telegraf";
import { validateCallbackPattern } from "../helper/utils";
import { CALLBACK_ACTIONS } from "../ama.constants";
import { AMA } from "../types";
import { buildAMAMessage, imageUrl } from "../helper/msg-builder";

export async function handleBroadcastNow(
  ctx: Context,
  publicGroupId: string,
  getAMABySessionNo: (sessionNo: number) => Promise<AMA | null>
): Promise<void> {
  const result = await validateCallbackPattern(
    ctx,
    CALLBACK_ACTIONS.BROADCAST_NOW,
    new RegExp(`^${CALLBACK_ACTIONS.BROADCAST_NOW}_(\\d+)$`)
  );
  if (!result) return;

  const { sessionNo } = result;

  const ama = await getAMABySessionNo(sessionNo);
  if (!ama) {
    await ctx.reply("AMA session not found.");
    return;
  }
  const message = buildAMAMessage({
    session_no: ama.session_no,
    date: ama.date,
    time: ama.time,
    total_pool: ama.total_pool,
    reward: ama.reward,
    winner_count: ama.winner_count,
    form_link: ama.form_link,
  });

  // Send the announcement to the public group
  const sent = await ctx.telegram.sendPhoto(publicGroupId, imageUrl, {
    caption: message,
    parse_mode: "HTML",
  });

  // Pin the message in the public group
  await ctx.telegram.pinChatMessage(publicGroupId, sent.message_id, {
    disable_notification: false, // set to true if you don't want to notify users
  });

  await ctx.reply("Announcement Broadcasted to the group successfully!");
}

export async function handleScheduleBroadcast(
  ctx: Context & { match: RegExpExecArray },
  getAMABySessionNo: (sessionNo: number) => Promise<AMA | null>,
  updateAMA: (sessionNo: number, updates: Partial<AMA>) => Promise<boolean>
): Promise<void> {
  const result = await validateCallbackPattern(
    ctx,
    CALLBACK_ACTIONS.SCHEDULE_BROADCAST,
    new RegExp(`^${CALLBACK_ACTIONS.SCHEDULE_BROADCAST}_(\\d+)$`)
  );
  if (!result) return;

  const { sessionNo } = result;

  const ama = await getAMABySessionNo(sessionNo);
  if (!ama) {
    await ctx.reply("AMA session not found.");
    return;
  }

  // Schedule the broadcast for 1 minute later (for testing purposes)
  const broadcastTime = new Date(Date.now() + 1 * 60 * 1000);

  // Update the AMA session with the scheduled broadcast time
  await updateAMA(sessionNo, {
    scheduled_at: broadcastTime,
    status: "scheduled",
  });

  await ctx.reply(
    `Scheduled AMA session ${ama.session_no} broadcast for ${broadcastTime.toLocaleString()}.`
  );
}
