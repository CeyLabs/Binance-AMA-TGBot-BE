import { Markup } from "telegraf";
import { AMA_HASHTAGS, CALLBACK_ACTIONS, EDIT_KEYS } from "../ama.constants";
import { EDITABLE_FIELDS } from "./helper/field-metadata";
import { buildAMAMessage, initImageUrl } from "./helper/msg-builder";
import { UUID_PATTERN, validateIdPattern } from "../helper/utils";
import { AMA, BotContext } from "../types";
import { UUID } from "crypto";
import { NewAMAKeyboard } from "./helper/keyboard.helper";
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";
import { TIMEZONES } from "../helper/date-utils";
dayjs.extend(utc);
dayjs.extend(timezone);

export function convertDateTimeToUTC(userDate: string, userTime: string): Date {
  let formattedDate: string;

  if (userDate.includes("/")) {
    // Format: DD/MM/YYYY
    const [day, month, year] = userDate.split("/");
    formattedDate = `${year}-${month}-${day}`; // YYYY-MM-DD
  } else if (userDate.includes("-")) {
    // Format: YYYY-MM-DD
    formattedDate = userDate;
  } else {
    throw new Error(`Invalid date format: ${userDate}`);
  }

  const timeWithSeconds = /^\d{2}:\d{2}$/.test(userTime) ? `${userTime}:00` : userTime;
  const combined = `${formattedDate}T${timeWithSeconds}`;

  const ksaTime = dayjs.tz(combined, TIMEZONES.KSA);
  if (!ksaTime.isValid()) {
    throw new Error(`Invalid datetime: ${combined}`);
  }

  return ksaTime.utc().toDate();
}

export async function handleEdit(ctx: BotContext): Promise<void> {
  const { editMode } = ctx.session;
  if (!editMode || !editMode.field) return;

  if (!ctx.message || !("text" in ctx.message)) return;

  const input = ctx.message.text.trim();
  const fieldMeta = EDITABLE_FIELDS[editMode.field];

  const validated = fieldMeta.validate(input);

  // If there's an error, show it to the user and return
  if (validated.error || validated.value === null) {
    await ctx.reply(validated.error ?? "❌ Invalid input.");
    return;
  }

  // Save the new value to session
  if (ctx.session.editMode) {
    ctx.session.editMode.newValue = String(validated.value);
  }

  // Edit the editingAnnouncementMsgId if it exists to remove the inline keyboard
  if (ctx.session.editingAnnouncementMsgId) {
    try {
      await ctx.telegram.editMessageReplyMarkup(
        ctx.chat?.id,
        ctx.session.editingAnnouncementMsgId,
        undefined,
        { inline_keyboard: [] },
      );
    } catch (err) {
      console.error("Failed to edit message reply markup:", err);
    }
  }

  // Initialize messagesToDelete array if needed
  ctx.session.messagesToDelete ??= [];

  const updatedMsg = await ctx.reply(
    `✅ Updated <b>${fieldMeta.name}</b>: <code>${validated.value}</code>`,
    {
      parse_mode: "HTML",
      // prettier-ignore
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback(`Edit ${fieldMeta.name}`,`edit-${editMode.field}_${editMode.amaId}`),
          Markup.button.callback("✅ Confirm",`${CALLBACK_ACTIONS.EDIT_CONFIRM}_${editMode.amaId}`),
        ],
        [
          Markup.button.callback("❌ Cancel",`${CALLBACK_ACTIONS.EDIT_CANCEL}_${editMode.amaId}`),
        ],
      ]).reply_markup,
    },
  );

  ctx.session.messagesToDelete.push(updatedMsg.message_id);
}

export async function handleConfirmEdit(
  ctx: BotContext,
  updateAMA: (id: UUID, data: Partial<AMA>) => Promise<boolean>,
  getAMAById: (id: UUID) => Promise<AMA | null>,
): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.EDIT_CONFIRM}_${UUID_PATTERN}`, "i"),
  );
  if (!result) return;
  const { id: AMA_ID } = result;
  const { field, newValue } = ctx.session.editMode || {};

  if (!AMA_ID || !field || newValue === undefined) {
    await ctx.reply("⚠️ No pending update.");
    return;
  }

  const updateData: Partial<AMA> = {};

  const fieldMeta = EDITABLE_FIELDS[field];

  const validAmaColumns: (keyof AMA)[] = [
    "session_no",
    "total_pool",
    "reward",
    "winner_count",
    "form_link",
    "special_guest",
    "topic",
    "banner_file_id",
  ];

  const column = fieldMeta.column;

  if (newValue !== undefined && validAmaColumns.includes(column as keyof AMA)) {
    updateData[column as keyof AMA] = newValue as never;
  }

  // If session_no is being updated, also update the hashtag
  if (fieldMeta.column === "session_no") {
    const sessionNo = Number(newValue);
    if (!isNaN(sessionNo)) {
      // Get the current AMA to check its language
      const ama = await getAMAById(AMA_ID);
      if (ama) {
        updateData["hashtag"] = `#${AMA_HASHTAGS[ama.language]}${sessionNo}`;
      }
    }
  }

  // Convert date and time fields to UTC if they are being updated
  // Combine date and time into UTC datetime if either is updated
  if (fieldMeta.column === "date" || fieldMeta.column === "time") {
    const ama = await getAMAById(AMA_ID);
    if (!ama) {
      await ctx.reply("❌ AMA not found.");
      return;
    }

    const newDate =
      fieldMeta.column === "date"
        ? String(newValue)
        : dayjs(ama.datetime).tz(TIMEZONES.KSA).format("DD/MM/YYYY");

    const newTime =
      fieldMeta.column === "time"
        ? String(newValue)
        : dayjs(ama.datetime).tz(TIMEZONES.KSA).format("HH:mm:ss");

    const datetimeUTC = convertDateTimeToUTC(newDate, newTime);

    // updateData["date"] = dayjs(newDate, "DD/MM/YYYY").format("YYYY-MM-DD");
    // updateData["time"] = /^\d{2}:\d{2}$/.test(newTime) ? `${newTime}:00` : newTime;
    updateData["datetime"] = datetimeUTC;
  }

  const success = await updateAMA(AMA_ID, updateData);

  if (!success) {
    await ctx.reply("❌ Failed to update AMA.");
    return;
  }

  delete ctx.session.editMode;

  await ctx.reply(`${fieldMeta.name} updated successfully`);

  const updated = await getAMAById(AMA_ID);
  if (updated) {
    const message = buildAMAMessage(updated);
    await ctx.replyWithPhoto(updated.banner_file_id || initImageUrl[updated.language], {
      caption: message,
      parse_mode: "HTML",
      reply_markup: NewAMAKeyboard(AMA_ID),
    });
  }

  if (ctx.session.messagesToDelete) {
    for (const msgId of ctx.session.messagesToDelete) {
      try {
        await ctx.deleteMessage(msgId);
      } catch (err) {
        console.error(`Failed to delete message ${msgId}:`, err);
      }
    }
    delete ctx.session.messagesToDelete;
  }
}

export async function handleCancelEdit(ctx: BotContext): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.EDIT_CANCEL}_${UUID_PATTERN}`, "i"),
  );
  if (!result) return;
  const { id: AMA_ID } = result;

  if (!ctx.session.editMode) {
    await ctx.reply("⚠️ No pending update to cancel.");
    return;
  }

  const fieldName = EDITABLE_FIELDS[ctx.session.editMode.field].name;
  delete ctx.session.editMode;

  if (ctx.session.messagesToDelete?.length) {
    for (const messageId of ctx.session.messagesToDelete) {
      try {
        await ctx.deleteMessage(messageId);
      } catch (error) {
        console.error("Failed to delete message:", error);
      }
    }
  }

  ctx.session.messagesToDelete = [];
  await ctx.reply(`⚠️ Edit for ${fieldName} has been cancelled.`);
  await ctx.answerCbQuery("Edit cancelled successfully.");

  // If editingAnnouncementMsgId exists, add the inline keyboard reply_markup: NewAMAKeyboard(AMA_ID),
  if (ctx.session.editingAnnouncementMsgId) {
    try {
      await ctx.telegram.editMessageReplyMarkup(
        ctx.chat?.id,
        ctx.session.editingAnnouncementMsgId,
        undefined,
        NewAMAKeyboard(AMA_ID),
      );
    } catch (err) {
      console.error("Failed to edit message reply markup:", err);
    }
  }
}

export async function handleBannerUpload(
  ctx: BotContext,
  getAMAById: (id: UUID) => Promise<AMA | null>,
  updateBanner: (amaId: UUID, file_id: string) => Promise<AMA | null>,
): Promise<void> {
  try {
    const session = ctx.session;
    if (!session?.editMode?.field || session.editMode.field !== EDIT_KEYS.BANNER) {
      return;
    }

    const message = ctx.message;
    if (!message || !("photo" in message)) {
      return;
    }

    const photo = message.photo;
    const file_id = photo[photo.length - 1].file_id; // Get highest resolution photo

    const ama = await getAMAById(session.editMode.amaId);

    if (!ama) {
      await ctx.reply("❌ AMA not found.");
      return;
    }

    // Edit the editingAnnouncementMsgId if it exists to remove the inline keyboard
    if (session.editingAnnouncementMsgId) {
      try {
        await ctx.telegram.editMessageReplyMarkup(
          ctx.chat?.id,
          session.editingAnnouncementMsgId,
          undefined,
          { inline_keyboard: [] },
        );
      } catch (err) {
        console.error("Failed to edit message reply markup:", err);
      }
    }

    // Update banner and get updated AMA details
    const updatedAma = await updateBanner(ama.id, file_id);

    if (updatedAma) {
      // Show success message
      const successMsg = await ctx.reply("✅ Banner has been updated successfully!");

      // Initialize messagesToDelete array if needed and add success message
      session.messagesToDelete ??= [];
      session.messagesToDelete.push(successMsg.message_id);

      // Build and send the updated announcement
      const message = buildAMAMessage({
        session_no: updatedAma.session_no,
        language: updatedAma.language,
        datetime: updatedAma.datetime,
        total_pool: updatedAma.total_pool,
        reward: updatedAma.reward,
        winner_count: updatedAma.winner_count,
        form_link: updatedAma.form_link,
        banner_file_id: file_id,
      });

      // Send updated announcement with the new banner
      const sent = await ctx.replyWithPhoto(file_id, {
        caption: message,
        parse_mode: "HTML",
        reply_markup: NewAMAKeyboard(ama.id),
      });

      // Store the new announcement message ID
      session.editingAnnouncementMsgId = sent.message_id;
    }

    delete session.editMode;
  } catch (error) {
    console.error("Error handling banner upload:", error);
    await ctx.reply("❌ Failed to update banner. Please try again.");
  }
}
