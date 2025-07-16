import { Context } from 'telegraf';

/**
 * Deletes the incoming command if it originates from outside the admin group
 * @param ctx Telegraf context
 * @param adminGroupId ID of the admin group
 * @returns true if the command was blocked and deleted
 */
export async function blockIfNotAdminGroup(
  ctx: Context,
  adminGroupId: string,
): Promise<boolean> {
  if (ctx.chat?.type !== 'private' && ctx.chat?.id?.toString() !== adminGroupId) {
    try {
      await ctx.deleteMessage();
    } catch (err) {
      console.error('Failed to delete command message', err);
    }
    return true;
  }
  return false;
}
