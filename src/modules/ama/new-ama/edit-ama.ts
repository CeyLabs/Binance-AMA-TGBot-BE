import { Markup } from "telegraf";
import { AMA_HASHTAG, CALLBACK_ACTIONS } from "../ama.constants";
import { EDITABLE_FIELDS } from "../helper/field-metadata";
import { buildAMAMessage, imageUrl } from "../helper/msg-builder";
import { UUID_PATTERN, validateIdPattern } from "../helper/utils";
import { AMA, BotContext } from "../types";
import { UUID } from "crypto";
import { NewAMAKeyboard } from "../helper/keyboard.helper";

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
    }
  );

  ctx.session.messagesToDelete.push(updatedMsg.message_id);
}

export async function handleConfirmEdit(
  ctx: BotContext,
  updateAMA: (id: UUID, data: Partial<AMA>) => Promise<boolean>,
  getAMAById: (id: UUID) => Promise<AMA | null>
): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.EDIT_CONFIRM}_${UUID_PATTERN}`, "i")
  );
  if (!result) return;
  const { id: AMA_ID } = result;
  const { field, newValue } = ctx.session.editMode || {};

  if (!AMA_ID || !field || newValue === undefined) {
    await ctx.reply("⚠️ No pending update.");
    return;
  }

  const fieldMeta = EDITABLE_FIELDS[field];

  // Prepare update payload
  const updateData: Partial<AMA> = {
    [fieldMeta.column]: newValue,
  };

  // If session_no is being updated, also update the hashtag
  if (fieldMeta.column === "session_no") {
    const sessionNo = Number(newValue);
    if (!isNaN(sessionNo)) {
      updateData["hashtag"] = `#${AMA_HASHTAG}${sessionNo}`;
    }
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
    await ctx.replyWithPhoto(imageUrl, {
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
