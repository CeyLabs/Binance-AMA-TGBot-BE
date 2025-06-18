import { Context } from "telegraf";
import { validateCallbackPattern } from "./utils";
import { CALLBACK_ACTIONS } from "../ama.constants";
import { AMA } from "./types";
import { buildAMAMessage, imageUrl } from "./msg-builder";

export async function handleConfirmAMA(ctx: Context): Promise<void> {
  const result = await validateCallbackPattern(
    ctx,
    CALLBACK_ACTIONS.CONFIRM,
    new RegExp(`^${CALLBACK_ACTIONS.CONFIRM}_(\\d+)$`)
  );
  if (!result) return;

  const { sessionNo } = result;

  await ctx.reply("Broadcast Announcement", {
    reply_markup: {
      // prettier-ignore
      inline_keyboard: [
        [
          {text: "Schedule Broadcast", callback_data: `${CALLBACK_ACTIONS.SCHEDULE_BROADCAST}_${sessionNo}`},
          {text: "Broadcast Now", callback_data: `${CALLBACK_ACTIONS.BROADCAST_NOW}_${sessionNo}`},
        ],
        [
          {text: "Cancel", callback_data: `${CALLBACK_ACTIONS.CANCEL_BROADCAST}_${sessionNo}`},
        ],
      ],
    },
  });
}

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

  await ctx.telegram.sendPhoto(publicGroupId, imageUrl, {
    caption: message,
    parse_mode: "HTML",
  });

  await ctx.reply("Announcement Broadcasted to the group successfully!");
}
