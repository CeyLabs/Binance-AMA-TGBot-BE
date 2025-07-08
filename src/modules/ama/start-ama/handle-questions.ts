import { Context } from "telegraf";
import { AMA_HASHTAGS } from "../ama.constants";
import { AMA, GroupInfo } from "../types";

export async function handleAMAQuestion(
  ctx: Context,
  groupIds: GroupInfo,
  getAMAsByHashtag: (hashtag: string) => Promise<AMA[]>,
  storeAMAQuestion: (
    amaId: string,
    userId: string,
    question: string,
    chatId: number,
    messageId: number,
    firstName: string,
    username: string,
  ) => Promise<void>,
): Promise<void> {
  const message = ctx.message;

  if (!message || !("text" in message) || message.from.is_bot) return;

  // Check for both English and Arabic hashtags
  const englishHashtag = `#${AMA_HASHTAGS["en"]}`.toLowerCase();
  const arabicHashtag = `#${AMA_HASHTAGS["ar"]}`.toLowerCase();
  const messageText = message.text.toLowerCase();

  if (
    message.text &&
    (messageText.includes(englishHashtag) || messageText.includes(arabicHashtag))
  ) {
    // Check which hashtag was used and create regex accordingly
    let amaHashtagMatch: RegExpMatchArray | null = null;
    if (messageText.includes(englishHashtag)) {
      amaHashtagMatch = message.text.match(new RegExp(`#${AMA_HASHTAGS["en"]}(\\d+)`, "i"));
    } else {
      amaHashtagMatch = message.text.match(new RegExp(`#${AMA_HASHTAGS["ar"]}(\\d+)`, "i"));
    }

    const hashtag = amaHashtagMatch ? amaHashtagMatch[0] : null;

    // Check if user has first_name
    if (!message.from.first_name) {
      await ctx.reply(
        "⚠️ Please set up a name in your Telegram profile before asking questions in the AMA.",
        {
          reply_parameters: {
            message_id: message.message_id,
          },
        },
      );
      return;
    }

    // Check if user has username
    if (!message.from.username) {
      await ctx.reply(
        "⚠️ Please set up a username in your Telegram profile before asking questions in the AMA.",
        {
          reply_parameters: {
            message_id: message.message_id,
          },
        },
      );
      return;
    }

    if (hashtag) {
      const amas = await getAMAsByHashtag(hashtag);

      // Early exit if no AMAs found for this hashtag
      if (!amas || amas.length === 0) {
        await ctx.reply("❌ No AMA found with this hashtag.", {
          reply_parameters: {
            message_id: message.message_id,
          },
        });
        return;
      }

      const publicChatId = message.chat.id.toString();

      const matchedAMA = amas.find((ama) => {
        const isActive = ama.status === "active";
        const isGroupMatch =
          (ama.language === "en" && publicChatId === groupIds.public.en) ||
          (ama.language === "ar" && publicChatId === groupIds.public.ar);
        return isActive && isGroupMatch && ama.thread_id;
      });

      if (matchedAMA) {
        const question = message.text;

        // Store message in database without analytics
        try {
          await storeAMAQuestion(
            matchedAMA.id,
            message.from.id.toString(),
            question,
            message.chat.id,
            message.message_id,
            message.from.first_name || "Unknown",
            message.from.username || "Unknown",
          );
        } catch (error) {
          console.error("Error processing AMA question:", error);
        }
      } else {
        await ctx.reply(
          "❌ No active AMA found for this hashtag in this group, or the AMA has not been started yet.",
          {
            reply_parameters: {
              message_id: message.message_id,
            },
          },
        );
      }
    }
  }
}
