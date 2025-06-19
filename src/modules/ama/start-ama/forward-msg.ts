import { Context } from "telegraf";
import { AMA_HASHTAG } from "../ama.constants";
import { AMA } from "../types";

export async function handleMsgForward(
  ctx: Context,
  adminGroupId: string,
  getAMAByHashtag: (hashtag: string) => Promise<AMA | null>
) {
  const message = ctx.message;

  if (!message || !("text" in message) || message.from.is_bot) return;

  if (message.text && message.text.includes(`#${AMA_HASHTAG}`)) {
    // Check if the message contains the AMA hashtag
    const amaHashtagMatch = message.text.match(
      new RegExp(`#${AMA_HASHTAG}(\\d+)`)
    );
    const hashtag = amaHashtagMatch ? amaHashtagMatch[0] : null;
    if (hashtag) {
      const ama = await getAMAByHashtag(hashtag);
      // Forward the message to the admin group if AMA is active
      if (ama && ama.status === "active" && ama.thread_id) {
        await ctx.telegram.forwardMessage(
          adminGroupId,
          ctx.message.chat.id,
          ctx.message.message_id,
          { message_thread_id: ama.thread_id }
        );
      }
    }
  }
}
