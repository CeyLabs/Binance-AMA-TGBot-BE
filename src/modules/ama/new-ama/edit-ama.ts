import { Markup } from "telegraf";
import { CALLBACK_ACTIONS } from "../ama.constants";
import { EDITABLE_FIELDS } from "../helper/field-metadata";
import { buildAMAMessage } from "../helper/msg-builder";
import { validateCallbackPattern } from "../helper/utils";
import { AMA, BotContext } from "../types";

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

  await ctx.reply(
    `Updated <b>${fieldMeta.column}</b>: <code>${validated}</code>`,
    {
      parse_mode: "HTML",
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("Cancel", `edit-cancel_${editMode.sessionNo}`)],
        [
          Markup.button.callback(
            "Confirm",
            `edit-confirm_${editMode.sessionNo}`
          ),
        ],
      ]).reply_markup,
    }
  );
}

export async function handleConfirmEdit(
  ctx: BotContext,
  updateAMA: (sessionNo: number, data: Partial<AMA>) => Promise<boolean>,
  getAMABySessionNo: (sessionNo: number) => Promise<AMA | null>
): Promise<void> {
  const result = await validateCallbackPattern(
    ctx,
    CALLBACK_ACTIONS.EDIT_CONFIRM,
    new RegExp(`^${CALLBACK_ACTIONS.EDIT_CONFIRM}_(\\d+)$`)
  );
  if (!result) return;
  const { sessionNo } = result;
  const { field, newValue } = ctx.session.editMode || {};

  if (!sessionNo || !field || newValue === undefined) {
    await ctx.reply("⚠️ No pending update.");
    return;
  }

  const column = EDITABLE_FIELDS[field].column;

  const success = await updateAMA(sessionNo, {
    [column]: newValue,
  } as Partial<AMA>);

  if (!success) {
    await ctx.reply("❌ Failed to update AMA.");
    return;
  }

  delete ctx.session.editMode;

  await ctx.reply(`${column} updated successfully`);

  const updated = await getAMABySessionNo(sessionNo);
  if (updated) {
    const message = buildAMAMessage(updated);
    await ctx.reply(message, { parse_mode: "HTML" });
  }
}
