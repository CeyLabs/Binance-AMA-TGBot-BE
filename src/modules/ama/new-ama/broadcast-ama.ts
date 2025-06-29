import { Context } from "telegraf";
import { UUID_PATTERN, validateIdPattern } from "../helper/utils";
import { CALLBACK_ACTIONS } from "../ama.constants";
import { AMA, BotContext, PublicGroupInfo } from "../types";
import { buildAMAMessage, imageUrl } from "./helper/msg-builder";
import { UUID } from "crypto";
import * as dayjs from "dayjs";
import { InlineKeyboardButton } from "telegraf/types";

export async function handleBroadcastNow(
  ctx: Context,
  publicGroupIds: PublicGroupInfo,
  getAMAById: (id: UUID) => Promise<AMA | null>,
  updateAMA: (id: UUID, updates: Partial<AMA>) => Promise<boolean>,
  clearSchedules?: (amaId: UUID) => Promise<void>,
): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.BROADCAST_NOW}_${UUID_PATTERN}`, "i"),
  );
  if (!result) return;

  const { id: AMA_ID } = result;

  const ama = await getAMAById(AMA_ID);
  if (!ama) {
    await ctx.reply("AMA session not found.");
    return;
  }
  const message = buildAMAMessage({
    session_no: ama.session_no,
    language: ama.language,
    date: ama.date,
    time: ama.time,
    total_pool: ama.total_pool,
    reward: ama.reward,
    winner_count: ama.winner_count,
    form_link: ama.form_link,
  });

  const publicGroupId = publicGroupIds[ama.language];

  // Send the announcement to the public group
  const sent = await ctx.telegram.sendPhoto(publicGroupId, imageUrl, {
    caption: message,
    parse_mode: "HTML",
  });

  // Pin the message in the public group
  await ctx.telegram.pinChatMessage(publicGroupId, sent.message_id, {
    disable_notification: false, // set to true if you don't want to notify users
  });

  // Update the AMA session status to 'broadcasted'
  await updateAMA(AMA_ID, {
    status: "broadcasted",
  });

  // Remove any pending schedules for this AMA
  if (clearSchedules) {
    await clearSchedules(AMA_ID);
  }

  await ctx.reply("Announcement Broadcasted to the group successfully!");

  // Delete the callback message
  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    await ctx.telegram.deleteMessage(
      ctx.callbackQuery.message.chat.id,
      ctx.callbackQuery.message.message_id,
    );
  }
}

export const scheduleOptions = [
  { key: "2d", label: "2 days before", offsetMinutes: 2880 },
  { key: "24h", label: "24 hours before", offsetMinutes: 1440 },
  { key: "6h", label: "6 hours before", offsetMinutes: 360 },
];

export async function handleScheduleBroadcast(
  ctx: BotContext,
  getAMAById: (id: UUID) => Promise<AMA | null>,
): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.SCHEDULE_BROADCAST}_${UUID_PATTERN}`, "i"),
  );
  if (!result) return;

  const amaId = result.id;
  const ama = await getAMAById(amaId);
  if (!ama) {
    await ctx.reply("❌ AMA session not found.");
    return;
  }

  const amaDateTime = dayjs(
    `${dayjs(ama.date).format("YYYY-MM-DD")} ${ama.time}`,
    "YYYY-MM-DD HH:mm:ss",
  );
  if (!amaDateTime.isValid()) {
    await ctx.reply("❌ Invalid AMA date/time.");
    return;
  }

  const now = dayjs();
  const validOptions: Record<string, boolean> = {};

  for (const option of scheduleOptions) {
    const scheduledTime = amaDateTime.subtract(option.offsetMinutes, "minute");
    if (scheduledTime.isAfter(now)) validOptions[option.key] = true;
  }

  if (Object.keys(validOptions).length === 0) {
    await ctx.reply("⚠️ No valid times left for scheduling broadcast.");
    return;
  }

  ctx.session.broadcastOptions ??= {};
  ctx.session.broadcastOptions[amaId] = validOptions;

  // Clear previous UI
  if (ctx.callbackQuery?.message) {
    await ctx.telegram.deleteMessage(
      ctx.callbackQuery.message.chat.id,
      ctx.callbackQuery.message.message_id,
    );
  }

  await ctx.reply("Schedule Announcement Broadcast", {
    reply_markup: {
      inline_keyboard: buildScheduleKeyboard(amaId, validOptions, validOptions),
    },
  });
}

export async function handleToggleSchedule(
  ctx: BotContext,
  getAMAById: (id: UUID) => Promise<AMA | null>,
): Promise<void> {
  const callbackData = (ctx.callbackQuery as any)?.data;
  const match = callbackData?.match(
    `^${CALLBACK_ACTIONS.TOGGLE_SCHEDULE}_(\\w+)_(${UUID_PATTERN})$`,
  );
  if (!match) await ctx.answerCbQuery("Invalid toggle action.");

  const [, key, amaId] = match;

  // Get AMA to check if the scheduled time is still valid
  const ama = await getAMAById(amaId);
  if (!ama) {
    await ctx.answerCbQuery("❌ AMA not found.");
    return;
  }

  const amaDateTime = dayjs(
    `${dayjs(ama.date).format("YYYY-MM-DD")} ${ama.time}`,
    "YYYY-MM-DD HH:mm:ss",
  );
  if (!amaDateTime.isValid()) {
    await ctx.answerCbQuery("❌ Invalid AMA date/time.");
    return;
  }

  // Check if the specific time slot is still valid
  const now = dayjs();
  const offset = scheduleOptions.find((o) => o.key === key)?.offsetMinutes || 0;
  const scheduledTime = amaDateTime.subtract(offset, "minute");

  if (scheduledTime.isBefore(now)) {
    await ctx.answerCbQuery("⏰ Cannot toggle - this time has already passed!");
  }

  ctx.session.broadcastOptions ??= {};
  ctx.session.broadcastOptions[amaId] ??= {};

  const current = ctx.session.broadcastOptions[amaId][key] ?? false;
  ctx.session.broadcastOptions[amaId][key] = !current;

  await ctx.answerCbQuery(`Toggled ${key}: ${!current ? "✅ ON" : "❌ OFF"}`);

  // Refresh the full markup with updated valid options
  const validOptions: Record<string, boolean> = {};
  for (const option of scheduleOptions) {
    const schedTime = amaDateTime.subtract(option.offsetMinutes, "minute");
    if (schedTime.isAfter(now)) validOptions[option.key] = true;
  }

  await ctx.editMessageReplyMarkup({
    inline_keyboard: buildScheduleKeyboard(
      amaId,
      ctx.session.broadcastOptions[amaId],
      validOptions,
    ),
  });
}

export async function handleConfirmSchedule(
  ctx: BotContext,
  amaId: UUID,
  getAMAById: (id: UUID) => Promise<AMA | null>,
  scheduleAMA: (id: UUID, time: Date) => Promise<void>,
): Promise<void> {
  const ama = await getAMAById(amaId);
  if (!ama) {
    await ctx.reply("❌ AMA not found.");
    return;
  }

  const amaDateTime = dayjs(
    `${dayjs(ama.date).format("YYYY-MM-DD")} ${ama.time}`,
    "YYYY-MM-DD HH:mm:ss",
  );
  if (!amaDateTime.isValid()) {
    await ctx.reply("❌ Invalid AMA date/time.");
    return;
  }

  const toggles = ctx.session.broadcastOptions?.[amaId];
  if (!toggles || Object.keys(toggles).length === 0) {
    await ctx.reply("❌ No valid times selected for scheduling.");
    return;
  }

  // Delete the callback message to clean up UI
  if (ctx.callbackQuery?.message) {
    await ctx.telegram.deleteMessage(
      ctx.callbackQuery.message.chat.id,
      ctx.callbackQuery.message.message_id,
    );
  }

  const now = dayjs();
  const scheduledTimes: Date[] = [];

  for (const [key, enabled] of Object.entries(toggles)) {
    if (!enabled) continue;
    const offset =
      scheduleOptions.find((o) => o.key === key)?.offsetMinutes || 0;
    const time = amaDateTime.subtract(offset, "minute");
    if (time.isAfter(now)) scheduledTimes.push(time.toDate());
  }

  if (scheduledTimes.length === 0) {
    await ctx.reply("❌ All selected times are in the past.");
    return;
  }

  try {
    for (const time of scheduledTimes) {
      await scheduleAMA(amaId, time);
      console.log(`✅ Scheduled AMA ${amaId} at ${time}`);
    }
    await ctx.reply(`✅ Scheduled ${scheduledTimes.length} broadcast(s).`);
  } catch (err) {
    console.error(err);
    await ctx.reply("❌ Failed to schedule one or more broadcasts.");
  } finally {
    delete ctx.session.broadcastOptions?.[amaId];
  }
}

//prettier-ignore
function buildScheduleKeyboard(
  amaId: UUID, 
  options: Record<string, boolean>, 
  validOptions?: Record<string, boolean>
) {
  const inline_keyboard: InlineKeyboardButton[][] = scheduleOptions.map(
    (opt) => {
      const enabled = options?.[opt.key] ?? false;
      const isValid = validOptions?.[opt.key] ?? true;
      
      // If time has passed, show disabled state and use disabled callback
      const toggleCallback = isValid 
        ? `${CALLBACK_ACTIONS.TOGGLE_SCHEDULE}_${opt.key}_${amaId}`
        : `${CALLBACK_ACTIONS.TOGGLE_DISABLED}_${opt.key}_${amaId}`;
      
      // Show different text for disabled options
      const statusText = isValid 
        ? (enabled ? "✅" : "❌")
        : "⏰"; // Clock emoji to indicate time has passed
      
      return [
        { text: opt.label, callback_data: "noop" },
        { text: statusText, callback_data: toggleCallback },
      ];
    }
  );

  inline_keyboard.push([
    {text: "Cancel", callback_data: `${CALLBACK_ACTIONS.CANCEL_BROADCAST}_${amaId}`},
    { text: "Confirm", callback_data: `${CALLBACK_ACTIONS.CONFIRM_SCHEDULE}_${amaId}` },
  ]);

  return inline_keyboard;
}
