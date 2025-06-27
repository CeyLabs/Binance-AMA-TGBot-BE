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
  updateAMA: (id: UUID, updates: Partial<AMA>) => Promise<boolean>
): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.BROADCAST_NOW}_${UUID_PATTERN}`, "i")
  );
  if (!result) return;

  const { id: AMA_ID } = result;

  const ama = await getAMAById(AMA_ID as UUID);
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

  await ctx.reply("Announcement Broadcasted to the group successfully!");

  // Delete the callback message
  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    await ctx.telegram.deleteMessage(
      ctx.callbackQuery.message.chat.id,
      ctx.callbackQuery.message.message_id
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
  getAMAById: (id: UUID) => Promise<AMA | null>
): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.SCHEDULE_BROADCAST}_${UUID_PATTERN}`, "i")
  );
  if (!result) return;

  const amaId = result.id;
  const ama = await getAMAById(amaId);
  if (!ama) return void ctx.reply("❌ AMA session not found.");

  const amaDateTime = dayjs(
    `${dayjs(ama.date).format("YYYY-MM-DD")} ${ama.time}`,
    "YYYY-MM-DD HH:mm:ss"
  );
  if (!amaDateTime.isValid())
    return void ctx.reply("❌ Invalid AMA date/time.");

  const now = dayjs();
  const validOptions: Record<string, boolean> = {};

  for (const option of scheduleOptions) {
    const scheduledTime = amaDateTime.subtract(option.offsetMinutes, "minute");
    if (scheduledTime.isAfter(now)) validOptions[option.key] = true;
  }

  if (Object.keys(validOptions).length === 0)
    return void ctx.reply("⚠️ No valid times left for scheduling broadcast.");

  ctx.session.broadcastOptions ??= {};
  ctx.session.broadcastOptions[amaId] = validOptions;

  // Clear previous UI
  if (ctx.callbackQuery?.message) {
    await ctx.telegram.deleteMessage(
      ctx.callbackQuery.message.chat.id,
      ctx.callbackQuery.message.message_id
    );
  }

  await ctx.reply("🕓 Select when to broadcast before AMA:", {
    reply_markup: {
      inline_keyboard: buildScheduleKeyboard(amaId, validOptions),
    },
  });
}

export async function handleToggleSchedule(ctx: BotContext): Promise<void> {
  const callbackData = (ctx.callbackQuery as any)?.data;
  const match = callbackData?.match(
    `^${CALLBACK_ACTIONS.TOGGLE_SCHEDULE}_(\\w+)_(${UUID_PATTERN})$`
  );
  if (!match) return void ctx.answerCbQuery("Invalid toggle action.");

  const [, key, amaId] = match;

  ctx.session.broadcastOptions ??= {};
  ctx.session.broadcastOptions[amaId] ??= {};

  const current = ctx.session.broadcastOptions[amaId][key] ?? false;
  ctx.session.broadcastOptions[amaId][key] = !current;

  await ctx.answerCbQuery(`Toggled ${key}: ${!current ? "✅ ON" : "❌ OFF"}`);

  // Refresh the full markup
  await ctx.editMessageReplyMarkup({
    inline_keyboard: buildScheduleKeyboard(
      amaId,
      ctx.session.broadcastOptions[amaId]
    ),
  });
}

export async function handleConfirmSchedule(
  ctx: BotContext,
  amaId: UUID,
  getAMAById: (id: UUID) => Promise<AMA | null>,
  scheduleAMA: (id: UUID, time: Date) => Promise<void>
): Promise<void> {
  const ama = await getAMAById(amaId);
  if (!ama) return void ctx.reply("❌ AMA not found.");

  const amaDateTime = dayjs(
    `${dayjs(ama.date).format("YYYY-MM-DD")} ${ama.time}`,
    "YYYY-MM-DD HH:mm:ss"
  );
  if (!amaDateTime.isValid())
    return void ctx.reply("❌ Invalid AMA date/time.");

  const toggles = ctx.session.broadcastOptions?.[amaId];
  if (!toggles || Object.keys(toggles).length === 0)
    return void ctx.reply("❌ No valid times selected for scheduling.");

  const now = dayjs();
  const scheduledTimes: Date[] = [];

  for (const [key, enabled] of Object.entries(toggles)) {
    if (!enabled) continue;
    const offset =
      scheduleOptions.find((o) => o.key === key)?.offsetMinutes || 0;
    const time = amaDateTime.subtract(offset, "minute");
    if (time.isAfter(now)) scheduledTimes.push(time.toDate());
  }

  if (scheduledTimes.length === 0)
    return void ctx.reply("❌ All selected times are in the past.");

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

// prettier-ignore
function buildScheduleKeyboard(amaId: UUID, options: Record<string, boolean>) {
  const inline_keyboard: InlineKeyboardButton[][] = scheduleOptions.map(
    (opt) => {
      const enabled = options?.[opt.key] ?? false;
      return [
        { text: opt.label, callback_data: "noop" },
        { text: enabled ? "✅" : "❌", callback_data: `${CALLBACK_ACTIONS.TOGGLE_SCHEDULE}_${opt.key}_${amaId}`},
      ];
    }
  );

  inline_keyboard.push([
    {text: "Cancel", callback_data: `${CALLBACK_ACTIONS.CANCEL_BROADCAST}_${amaId}`},
    { text: "Confirm", callback_data: `cfm_${amaId}` },
  ]);

  return inline_keyboard;
}
