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
