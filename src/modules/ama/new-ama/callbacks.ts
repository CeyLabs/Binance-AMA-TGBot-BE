import { Context } from "telegraf";
import { validateCallbackPattern } from "../helper/utils";
import { CALLBACK_ACTIONS } from "../ama.constants";

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
          // {text: "Schedule Broadcast", callback_data: `${CALLBACK_ACTIONS.SCHEDULE_BROADCAST}_${sessionNo}`},
          {text: "Broadcast Now", callback_data: `${CALLBACK_ACTIONS.BROADCAST_NOW}_${sessionNo}`},
        ],
        [
          {text: "Cancel", callback_data: `${CALLBACK_ACTIONS.CANCEL_BROADCAST}_${sessionNo}`},
        ],
      ],
    },
  });
}

