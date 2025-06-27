import { Context } from "telegraf";
import { UUID_PATTERN, validateIdPattern } from "../helper/utils";
import { CALLBACK_ACTIONS } from "../ama.constants";
import { AMA, BotContext, PublicGroupInfo } from "../types";
import { buildAMAMessage, imageUrl } from "./helper/msg-builder";
import { UUID } from "crypto";
import * as dayjs from "dayjs";

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
  { key: "1m", label: "1 min before", offsetMinutes: 1 },
  { key: "2m", label: "2 min before", offsetMinutes: 2 },
  { key: "3m", label: "3 min before", offsetMinutes: 3 },
  { key: "4m", label: "4 min before", offsetMinutes: 4 },
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

  const { id: AMA_ID } = result;
  const ama = await getAMAById(AMA_ID);

  if (!ama) {
    await ctx.reply("❌ AMA session not found.");
    return;
  }

  const amaDateTime = dayjs(
    `${dayjs(ama.date).format("YYYY-MM-DD")} ${ama.time}`,
    "YYYY-MM-DD HH:mm:ss"
  );

  if (!amaDateTime.isValid()) {
    await ctx.reply("❌ Invalid AMA date/time.");
    return;
  }

  const now = dayjs();
  const session = ctx.session;

  if (!session.broadcastOptions) session.broadcastOptions = {};

  // Initialize valid future broadcast options
  if (!session.broadcastOptions[AMA_ID]) {
    const validOptions: Record<string, boolean> = {};
    for (const option of scheduleOptions) {
      const targetTime = amaDateTime.subtract(option.offsetMinutes, "minute");
      if (targetTime.isAfter(now)) {
        validOptions[option.key] = true;
      }
    }

    if (Object.keys(validOptions).length === 0) {
      await ctx.reply("⚠️ No valid times left for scheduling broadcast.");
      return;
    }

    session.broadcastOptions[AMA_ID] = validOptions;
  }

  // Clean previous UI
  if (ctx.callbackQuery?.message) {
    await ctx.telegram.deleteMessage(
      ctx.callbackQuery.message.chat.id,
      ctx.callbackQuery.message.message_id
    );
  }

  // Build keyboard dynamically
  const inline_keyboard = scheduleOptions.map((opt) => {
    const isEnabled = session.broadcastOptions?.[AMA_ID]?.[opt.key] ?? false;
    return [
      {
        text: opt.label,
        callback_data: "noop", // label only
      },
      {
        text: isEnabled ? "✅" : "❎",
        callback_data: `toggle_${opt.key}_${AMA_ID}`,
      },
    ];
  });

  inline_keyboard.push([
    {
      text: "Cancel",
      callback_data: `${CALLBACK_ACTIONS.CANCEL_BROADCAST}_${AMA_ID}`,
    },
    { text: "Confirm", callback_data: `cfm_${AMA_ID}` },
  ]);

  await ctx.reply("🕓 Select when to broadcast before AMA:", {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard,
    },
  });
}

export async function handleConfirmSchedule(
  ctx: BotContext,
  amaId: UUID,
  getAMAById: (id: UUID) => Promise<AMA | null>,
  scheduleAMA: (id: UUID, time: Date) => Promise<void>
) {
  const ama = await getAMAById(amaId);
  if (!ama) {
    await ctx.reply("AMA not found.");
    return;
  }

  const amaDateTime = dayjs(
    `${dayjs(ama.date).format("YYYY-MM-DD")} ${ama.time}`,
    "YYYY-MM-DD HH:mm:ss"
  );
  const toggles = ctx.session.broadcastOptions?.[amaId];
  if (!toggles) {
    await ctx.reply("No times selected.");
    return;
  }

  // calculate scheduled times
  if (Object.keys(toggles).length === 0) {
    await ctx.reply("❌ No valid times selected for scheduling.");
    return;
  }

  const scheduledTimes: Date[] = [];

  // Get the ama date and time and then subtract the offset minutes and create all the scheduled times
  for (const [key, enabled] of Object.entries(toggles)) {
    if (!enabled) continue; // skip disabled options
    const offsetMinutes = parseInt(key.replace("m", ""), 10);
    const scheduledTime = amaDateTime
      .subtract(offsetMinutes, "minute")
      .toDate();
    if (scheduledTime > new Date()) {
      // only schedule future times
      scheduledTimes.push(scheduledTime);
    }
  }

  if (scheduledTimes.length === 0) {
    await ctx.reply("❌ No valid times left for scheduling.");
    return;
  }
  console.log("Scheduled Times:", scheduledTimes);
  // Schedule each time
  for (const scheduledTime of scheduledTimes) {
    try {
      await scheduleAMA(amaId, scheduledTime);
      console.log(`Scheduled AMA ${amaId} at ${scheduledTime}`);
    } catch (error) {
      console.error(
        `Failed to schedule AMA ${amaId} at ${scheduledTime}:`,
        error
      );
      await ctx.reply(`❌ Failed to schedule AMA at ${scheduledTime}.`);
      return;
    } finally {
      // Clean up the session for this AMA
      if (ctx.session.broadcastOptions?.[amaId]) {
        delete ctx.session.broadcastOptions[amaId];
      }
    }
  }

  await ctx.reply(`✅ Scheduled ${scheduledTimes.length} broadcast(s).`);
  delete ctx.session.broadcastOptions?.[amaId]; // clear session
}
