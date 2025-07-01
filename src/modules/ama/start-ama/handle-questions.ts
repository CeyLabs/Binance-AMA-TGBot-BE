import { Context } from "telegraf";
import { AMA_HASHTAG } from "../ama.constants";
import { AMA, GroupInfo, OpenAIAnalysis, CreateScoreData } from "../types";
import type { TelegramEmoji } from "telegraf/types";
import { MessageQueueService } from "../../message-queue/message-queue.service";
import { UUID } from "crypto";

export async function handleAMAQuestion(
  ctx: Context,
  groupIds: GroupInfo,
  getAMAsByHashtag: (hashtag: string) => Promise<AMA[]>,
  getAnalysis: (question: string, topic?: string) => Promise<OpenAIAnalysis | null>,
  addScore: (scoreData: CreateScoreData, name?: string, username?: string) => Promise<boolean>,
  messageQueueService?: MessageQueueService,
  trackForwardedMessage?: (
    original_msg_id: number,
    forwarded_msg_id: number,
    ama_id: UUID,
  ) => Promise<boolean>,
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

        // Forward question to admin group thread
        const forwardedMsg = await ctx.telegram.forwardMessage(
          groupIds.admin,
          message.chat.id,
          message.message_id,
          {
            message_thread_id: matchedAMA.thread_id,
          },
        );

        // Track the forwarded message for later reference
        if (messageQueueService && trackForwardedMessage) {
          const tracked = await trackForwardedMessage(
            message.message_id,
            forwardedMsg.message_id,
            matchedAMA.id,
          );

          if (!tracked) {
            console.warn("Failed to track forwarded message");
          }
        }

        // No initial reaction - we'll add heart after processing

        // If message queue service is available, use it
        if (messageQueueService) {
          // Add question to queue for processing
          await messageQueueService.addToQueue({
            ama_id: matchedAMA.id,
            user_id: message.from.id.toString(),
            question,
            username: message.from.username,
            name: message.from.first_name,
            chat_id: message.chat.id,
            message_id: message.message_id,
            tg_msg_id: message.message_id,
            topic: matchedAMA.topic,
          });
        } else {
          // Fallback to original synchronous processing if queue service is not available
          const analysis = await getAnalysis(question, matchedAMA.topic);

          let analysisMessage: string;

          if (!analysis) {
            analysisMessage = "⚠️ Analysis failed. Please try again later.";

            await ctx.telegram.sendMessage(groupIds.admin, analysisMessage, {
              reply_parameters: {
                message_id: forwardedMsg.message_id,
              },
            });
          } else {
            analysisMessage =
              `<b>📊 AI Analysis</b>\n\n` +
              `<b>✨ Originality:</b> ${analysis.originality?.score}/10\n` +
              `<i>${analysis.originality?.comment}</i>\n\n` +
              `<b>🎯 Relevance:</b> ${analysis.relevance?.score}/10\n` +
              `<i>${analysis.relevance?.comment}</i>\n\n` +
              `<b>🔍 Clarity:</b> ${analysis.clarity?.score}/10\n` +
              `<i>${analysis.clarity?.comment}</i>\n\n` +
              `<b>📢 Engagement:</b> ${analysis.engagement?.score}/10\n` +
              `<i>${analysis.engagement?.comment}</i>\n\n` +
              `<b>✍️ Language:</b> ${analysis.language?.score}/10\n` +
              `<i>${analysis.language?.comment}</i>\n\n` +
              `<b>🏁 Total Score:</b> <b>${analysis.total_score}/50</b>`;

            await ctx.telegram.sendMessage(groupIds.admin, analysisMessage, {
              reply_parameters: {
                message_id: forwardedMsg.message_id,
              },
              parse_mode: "HTML",
            });
          }

          const scoreData: CreateScoreData = {
            ama_id: matchedAMA.id,
            user_id: message.from.id.toString(),
            question: question,
            originality: analysis?.originality?.score || 0,
            relevance: analysis?.relevance?.score || 0,
            clarity: analysis?.clarity?.score || 0,
            engagement: analysis?.engagement?.score || 0,
            language: analysis?.language?.score || 0,
            score: analysis?.total_score || 0,
          };

          const addScoreToDb = await addScore(
            scoreData,
            message.from.first_name || "Unknown",
            message.from.username || "Unknown",
          );

          if (addScoreToDb && analysis) {
            await ctx.telegram.callApi("setMessageReaction", {
              chat_id: message.chat.id,
              message_id: message.message_id,
              reaction: [{ type: "emoji", emoji: "❤️" as TelegramEmoji }],
            });
          }
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
