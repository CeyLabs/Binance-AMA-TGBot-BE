import { UUID } from "crypto";
import { AMA, BotContext, ScheduleType } from "../types";
import { CALLBACK_ACTIONS } from "../ama.constants";
import { fetchAndValidateAMA, validateCallbackData } from "./helper/utils";

import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";
import { TIMEZONES } from "../helper/date-utils";

dayjs.extend(utc);
dayjs.extend(timezone);

export async function broadcastWinnersCallback(
  ctx: BotContext,
  getAMAById: (id: UUID) => Promise<AMA | null>,
): Promise<void> {
  const result = await validateCallbackData(ctx, CALLBACK_ACTIONS.SCHEDULE_WINNERS_BROADCAST);
  if (!result) return;

  const { amaId } = result;
  const ama = await fetchAndValidateAMA(getAMAById, amaId);
  if (!ama) {
    return void ctx.reply("AMA session not found.");
  }

  // Check if the AMA is in a valid state for broadcasting winners
  if (ama.status !== "ended") {
    return void ctx.reply("Winners can only be broadcasted for ended AMA sessions.");
  }

  // Makes the session active
  ctx.session.scheduledWinnersBroadcast = {
    amaId: ama.id,
    scheduledTime: undefined,
  };

  // Remove the reply markup from the previous message
  await ctx.editMessageReplyMarkup({
    inline_keyboard: [],
  });

  // Send a message to the user to provide the date and time for broadcasting winners
  await ctx.reply(
    `<b>🗓️ Please provide the date and time to broadcast the winners for AMA session #${ama.session_no}.</b>\n` +
      `<i>Timezone:</i> <b>KSA (${TIMEZONES.KSA})</b>\n` +
      `<i>Format:</i> <code>YYYY/MM/DD HH:mm (24h)</code>\n` +
      `\n\n` +
      `<b>Example:</b> <code>2026/06/15 18:30</code>`,
    { parse_mode: "HTML" },
  );
}

export async function scheduleWinnersBroadcast(
  ctx: BotContext,
  scheduleAMA: (ama_id: UUID, scheduled_time: Date, type: ScheduleType) => Promise<void>,
): Promise<void> {
  const { scheduledWinnersBroadcast } = ctx.session;
  if (!scheduledWinnersBroadcast || !scheduledWinnersBroadcast.amaId) {
    return void ctx.reply("No winners broadcast scheduled.");
  }

  if (!ctx.message || !("text" in ctx.message)) return;

  const input = ctx.message.text.trim();

  // Validate the input format - try both YYYY/MM/DD and DD/MM/YYYY formats
  const scheduled = dayjs.tz(input, "YYYY/MM/DD HH:mm", TIMEZONES.KSA);
  
  if (!scheduled.isValid()) {
    await ctx.reply("❌ Invalid date and time format. Please use: YYYY/MM/DD HH:mm or DD/MM/YYYY HH:mm\n\nExample: 2025/07/16 23:30 or 16/07/2025 23:30");
    return;
  }

  if (scheduled.isBefore(dayjs())) {
    return void ctx.reply(
      "The scheduled time cannot be in the past. Please provide a future date and time.",
    );
  }

  // Schedule the AMA with the provided date and time
  try {
    await scheduleAMA(scheduledWinnersBroadcast.amaId, scheduled.toDate(), "winner");
    await ctx.reply(`Winners broadcast has been scheduled.`);
  } catch (error) {
    console.error("Error scheduling winners broadcast:", error);
    return void ctx.reply(
      "An error occurred while scheduling the winners broadcast. Please try again later.",
    );
  }
}
