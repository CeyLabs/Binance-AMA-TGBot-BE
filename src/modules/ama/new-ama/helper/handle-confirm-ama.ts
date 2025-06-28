import { Context } from "telegraf";
import { UUID_PATTERN, validateIdPattern } from "../../helper/utils";
import { CALLBACK_ACTIONS } from "../../ama.constants";

export async function handleConfirmAMA(ctx: Context): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.CONFIRM}_${UUID_PATTERN}`, "i"),
  );

  if (!result) return;

  const { id: AMA_ID } = result;

  if (!AMA_ID) {
    await ctx.reply("Invalid AMA ID.");
    return;
  }

  // Edit the message to remove inline keyboard
  await ctx.editMessageReplyMarkup({
    inline_keyboard: [],
  });

  await ctx.reply("Broadcast Announcement", {
    reply_markup: {
      // prettier-ignore
      inline_keyboard: [
        [
          {text: "Schedule Broadcast", callback_data: `${CALLBACK_ACTIONS.SCHEDULE_BROADCAST}_${AMA_ID}`},
          {text: "Broadcast Now", callback_data: `${CALLBACK_ACTIONS.BROADCAST_NOW}_${AMA_ID}`},
        ],
        [
          {text: "Cancel", callback_data: `${CALLBACK_ACTIONS.CANCEL_BROADCAST}_${AMA_ID}`},
        ],
      ],
    },
  });
}
