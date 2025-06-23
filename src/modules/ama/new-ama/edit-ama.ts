import { Markup } from "telegraf";
import { CALLBACK_ACTIONS } from "../ama.constants";
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
  if (!validated) {
    await ctx.reply("❌ Invalid format. " + fieldMeta.prompt);
    return;
  }

  if (ctx.session.editMode) {
    ctx.session.editMode.newValue = validated;
  }

  // Store messages for deletion
  ctx.session.messagesToDelete ??= [];

  // if (ctx.message.message_id) {
  //   ctx.session.messagesToDelete.push(ctx.message.message_id);
  // }

  const updatedMsg = await ctx.reply(
    `Updated <b>${fieldMeta.column}</b>: <code>${validated}</code>`,
    {
      parse_mode: "HTML",
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("Cancel", `edit-cancel_${editMode.amaId}`)],
        [Markup.button.callback("Confirm", `edit-confirm_${editMode.amaId}`)],
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

  const column = EDITABLE_FIELDS[field].column;

  const success = await updateAMA(AMA_ID, {
    [column]: newValue,
  } as Partial<AMA>);

  if (!success) {
    await ctx.reply("❌ Failed to update AMA.");
    return;
  }

  delete ctx.session.editMode;

  await ctx.reply(`${column} updated successfully`);

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
