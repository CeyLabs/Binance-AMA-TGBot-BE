import { Context } from "telegraf";
import { AMA_HASHTAG } from "../ama.constants";
import { AMA, GroupInfo } from "../types";
import { KnexService } from "../../knex/knex.service";

export async function handleAMAQuestion(
  ctx: Context,
  groupIds: GroupInfo,
  getAMAsByHashtag: (hashtag: string) => Promise<AMA[]>,
  knexService: KnexService,
): Promise<void> {
  const message = ctx.message;

  if (!message || !("text" in message) || message.from.is_bot) return;

  if (message.text && message.text.toLowerCase().includes(`#${AMA_HASHTAG.toLowerCase()}`)) {
    const amaHashtagMatch = message.text.match(new RegExp(`#${AMA_HASHTAG}(\\d+)`, "i"));
    const hashtag = amaHashtagMatch ? amaHashtagMatch[0] : null;

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
          // First, ensure user exists in the user table
          await knexService
            .knex("user")
            .insert({
              user_id: message.from.id.toString(),
              name: message.from.first_name || "Unknown",
              username: message.from.username || "Unknown",
            })
            .onConflict("user_id")
            .merge({
              name: message.from.first_name || "Unknown",
              username: message.from.username || "Unknown",
              updated_at: new Date(),
            });

          // Store the message in the database
          await knexService.knex("message").insert({
            ama_id: matchedAMA.id,
            user_id: message.from.id.toString(),
            question: question,
            chat_id: message.chat.id,
            tg_msg_id: message.message_id,
            // Set default values for score fields
            originality: 0,
            relevance: 0,
            clarity: 0,
            engagement: 0,
            language: 0,
            score: 0,
            // Mark as unprocessed so the cron job will pick it up
            processed: false,
          });
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
