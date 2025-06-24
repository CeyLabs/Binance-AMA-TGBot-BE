import { Context } from "telegraf";
import { UUID_PATTERN, validateIdPattern } from "../helper/utils";
import { CALLBACK_ACTIONS } from "../ama.constants";
import { AMA, PublicGroupInfo } from "../types";
import { buildAMAMessage, imageUrl } from "../helper/msg-builder";
import { UUID } from "crypto";

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

const scheduleOptions = [
  { label: "2 Days Before", key: "2DAYS" },
  { label: "24 Hours Before", key: "24H" },
  { label: "6 Hours Before", key: "6H" },
];

export async function handleScheduleBroadcast(
  ctx: Context,
  getAMAById: (id: UUID) => Promise<AMA | null>,
  updateAMA: (id: UUID, updates: Partial<AMA>) => Promise<boolean>
): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.SCHEDULE_BROADCAST}_${UUID_PATTERN}`, "i")
  );
  if (!result) return;

  const { id: AMA_ID } = result;

  const ama = await getAMAById(AMA_ID);
  if (!ama) {
    await ctx.reply("AMA session not found.");
    return;
  }

  await ctx.reply("Schedule Announcement Broadcast", {
    reply_markup: {
      inline_keyboard: [
        ...scheduleOptions.map((option) => [
          {
            text: option.label,
            callback_data: `schedule_${option.key}_${AMA_ID}`,
          },
          {
            text: "✅ / ❎",
            callback_data: `toggle_${option.key}_${AMA_ID}`,
          },
        ]),
        [
          {
            text: "Cancel",
            callback_data: `cancel_${AMA_ID}`,
          },
          {
            text: "Confirm",
            callback_data: `confirm_${AMA_ID}`,
          },
        ],
      ],
    },
  });

  // Schedule the broadcast for 1 minute later (for testing purposes)
  const broadcastTime = new Date(Date.now() + 1 * 60 * 1000);

  // Update the AMA session with the scheduled broadcast time
  await updateAMA(AMA_ID, {
    scheduled_at: broadcastTime,
    status: "scheduled",
  });

  await ctx.reply(
    `Scheduled AMA session ${ama.session_no} broadcast for ${broadcastTime.toLocaleString()}.`
  );
}
