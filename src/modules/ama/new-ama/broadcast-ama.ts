import { Context } from "telegraf";
import { UUID_PATTERN, validateIdPattern, delay } from "../helper/utils";
import { CALLBACK_ACTIONS, HIDDEN_KEYS } from "../ama.constants";
import { AMA, BotContext, PublicGroupInfo, ScheduleType, User, SupportedLanguage } from "../types";
import { buildAMAMessage, initImageUrl } from "./helper/msg-builder";
import { UUID } from "crypto";
import * as dayjs from "dayjs";
import { InlineKeyboardButton } from "telegraf/types";

export async function handleBroadcastNow(
  ctx: Context,
  publicGroupIds: PublicGroupInfo,
  getAMAById: (id: UUID) => Promise<AMA | null>,
  updateAMA: (id: UUID, updates: Partial<AMA>) => Promise<boolean>,
  getSubscribers: (lang: SupportedLanguage) => Promise<User[]>,
  botUsername: string,
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
    datetime: ama.datetime,
    total_pool: ama.total_pool,
    reward: ama.reward,
    winner_count: ama.winner_count,
    form_link: ama.form_link,
    banner_file_id: ama.banner_file_id,
  });

  const publicGroupId = publicGroupIds[ama.language];

  // Send the announcement to the public group using custom banner if available
  const subscribeUrl = `https://t.me/${botUsername}?start=${
    ama.language === "ar" ? HIDDEN_KEYS.SUBSCRIBE_AR : HIDDEN_KEYS.SUBSCRIBE_EN
  }`;
  const inlineKeyboard =
    ama.language === "ar"
      ? [
          [{ text: "املأ الاستمارة 👉", url: ama.form_link }],
          [{ text: "قم بتعيين تذكير ⏰", url: subscribeUrl }],
        ]
      : [
          [{ text: "👉 Submit the form", url: ama.form_link }],
          [{ text: "⏰ Set a reminder", url: subscribeUrl }],
        ];

  const image = initImageUrl[ama.language];
  const sent = await ctx.telegram.sendPhoto(publicGroupId, ama.banner_file_id || image, {
    caption: message,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  });

  // Pin the message in the public group
  await ctx.telegram.pinChatMessage(publicGroupId, sent.message_id, {
    disable_notification: false, // set to true if you don't want to notify users
  });

  // Send announcement to subscribed users
  const subscribers = await getSubscribers(ama.language);
  for (const user of subscribers) {
    try {
      await ctx.telegram.sendPhoto(user.user_id, ama.banner_file_id || image, {
        caption: message,
        parse_mode: "HTML",
      });
    } catch (err) {
      console.error(`Failed to send announcement to ${user.user_id}:`, err);
    }
    await delay(200);
  }

  // Update the AMA session status to 'broadcasted'
  await updateAMA(AMA_ID, {
    status: "broadcasted",
  });

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
  { key: "3d", label: "3 days before", offsetMinutes: 4320 },
  { key: "2d", label: "2 days before", offsetMinutes: 2880 },
  { key: "24h", label: "24 hours before", offsetMinutes: 1440 },
  { key: "18h", label: "18 hours before", offsetMinutes: 1080 },
  { key: "12h", label: "12 hours before", offsetMinutes: 720 },
  { key: "6h", label: "6 hours before", offsetMinutes: 360 },
  { key: "1h", label: "1 hour before", offsetMinutes: 60 },
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

  const amaDateTime = dayjs(ama.datetime);
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
  if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
    await ctx.answerCbQuery("Invalid callback query.");
    return;
  }

  const callbackData = ctx.callbackQuery.data;
  const match = callbackData.match(
    new RegExp(`^${CALLBACK_ACTIONS.TOGGLE_SCHEDULE}_(\\w+)_(${UUID_PATTERN})$`),
  );

  if (!match) {
    await ctx.answerCbQuery("Invalid toggle action.");
    return;
  }

  const [, key, amaId] = match;

  // Get AMA to check if the scheduled time is still valid
  const ama = await getAMAById(amaId as UUID);
  if (!ama) {
    await ctx.answerCbQuery("❌ AMA not found.");
    return;
  }

  const amaDateTime = dayjs(ama.datetime);
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
  ctx.session.broadcastOptions[amaId as UUID] ??= {};

  const current = ctx.session.broadcastOptions[amaId as UUID]?.[key] ?? false;
  const options = ctx.session.broadcastOptions[amaId as UUID];
  if (options) {
    options[key] = !current;
  }

  await ctx.answerCbQuery(`Toggled ${key}: ${!current ? "✅ ON" : "❌ OFF"}`);

  // Refresh the full markup with updated valid options
  const validOptions: Record<string, boolean> = {};
  for (const option of scheduleOptions) {
    const schedTime = amaDateTime.subtract(option.offsetMinutes, "minute");
    if (schedTime.isAfter(now)) validOptions[option.key] = true;
  }

  await ctx.editMessageReplyMarkup({
    inline_keyboard: buildScheduleKeyboard(
      amaId as UUID,
      ctx.session.broadcastOptions[amaId as UUID] ?? {},
      validOptions,
    ),
  });
}

export async function handleConfirmSchedule(
  ctx: BotContext,
  amaId: UUID,
  getAMAById: (id: UUID) => Promise<AMA | null>,
  scheduleAMA: (id: UUID, time: Date, type: ScheduleType) => Promise<void>,
): Promise<void> {
  const ama = await getAMAById(amaId);
  if (!ama) {
    await ctx.reply("❌ AMA not found.");
    return;
  }

  const amaDateTime = dayjs(ama.datetime);
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
    const offset = scheduleOptions.find((o) => o.key === key)?.offsetMinutes || 0;
    const time = amaDateTime.subtract(offset, "minute");
    if (time.isAfter(now)) scheduledTimes.push(time.toDate());
  }

  if (scheduledTimes.length === 0) {
    await ctx.reply("❌ All selected times are in the past.");
    return;
  }

  try {
    for (const time of scheduledTimes) {
      await scheduleAMA(amaId, time, "init");
      console.log(`✅ Scheduled AMA ${amaId} at ${time.toISOString()}`);
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
