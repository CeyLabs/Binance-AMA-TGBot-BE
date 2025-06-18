import { AMA, BotContext } from "../types";
import { EDITABLE_FIELDS } from "./field-metadata";
import { validateCallbackPattern } from "./utils";

/**
 * Handles edit requests for AMA fields
 */
export async function handleEditRequest(
  ctx: BotContext,
  field: keyof typeof EDITABLE_FIELDS,
  action: string,
  getAMABySessionNo: (sessionNo: number) => Promise<AMA | null>
): Promise<void> {
  const result = await validateCallbackPattern(
    ctx,
    action,
    new RegExp(`^${action}_(\\d+)$`)
  );
  if (!result) return;

  const { sessionNo } = result;
  const ama = await getAMABySessionNo(sessionNo);
  if (!ama) {
    await ctx.reply(`AMA session number ${sessionNo} does not exist.`);
    return;
  }

  ctx.session.editMode = { sessionNo, field };

  const prompt = EDITABLE_FIELDS[field]?.prompt || "Enter new value:";
  await ctx.reply(prompt);
}
