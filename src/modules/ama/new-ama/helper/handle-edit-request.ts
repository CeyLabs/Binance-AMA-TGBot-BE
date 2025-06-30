import { UUID } from "crypto";
import { AMA, BotContext, EditableFieldKey } from "../../types";
import { EDITABLE_FIELDS } from "./field-metadata";
import { UUID_PATTERN, validateIdPattern } from "../../helper/utils";
/**
 * Handles edit requests for AMA fields
 */
export async function handleEditRequest(
  ctx: BotContext,
  field: EditableFieldKey,
  action: string,
  getAMAById: (id: UUID) => Promise<AMA | null>
): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${action}_${UUID_PATTERN}`, "i")
  );

  console.log("Result from validateIdPattern:", result);
  if (!result) return;

  const { id: AMA_ID } = result;

  const ama = await getAMAById(AMA_ID);
  if (!ama) {
    await ctx.reply(`AMA does not exist.`);
    return;
  }

  // Store the message ID to delete later
  ctx.session.messagesToDelete = ctx.message?.message_id
    ? [ctx.message.message_id]
    : [];

  ctx.session.editMode = { amaId: AMA_ID, field };

  const prompt = EDITABLE_FIELDS[field]?.prompt || "Enter new value:";
  const promptMsg = await ctx.reply(prompt);

  // Store both the prompt message ID and prepare for new value message ID to delete later
  ctx.session.messagesToDelete.push(promptMsg.message_id);
}