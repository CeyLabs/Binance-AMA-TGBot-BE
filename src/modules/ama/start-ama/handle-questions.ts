import { Context } from "telegraf";
import { AMA_HASHTAG } from "../ama.constants";
import { AMA, OpenAIAnalysis, ScoreData } from "../types";
import type { TelegramEmoji } from "telegraf/types";

export async function handleAMAQuestion(
  ctx: Context,
  adminGroupId: string,
  getAMAByHashtag: (hashtag: string) => Promise<AMA | null>,
  getAnalysis: (
    question: string,
    topic?: string
  ) => Promise<OpenAIAnalysis | null>,
  addScore: (scoreData: ScoreData) => Promise<boolean>
) {
  const message = ctx.message;

  if (!message || !("text" in message) || message.from.is_bot) return;

  if (message.text && message.text.includes(`#${AMA_HASHTAG}`)) {
    const amaHashtagMatch = message.text.match(
      new RegExp(`#${AMA_HASHTAG}(\\d+)`)
    );
    const hashtag = amaHashtagMatch ? amaHashtagMatch[0] : null;

    if (hashtag) {
      const ama = await getAMAByHashtag(hashtag);

      if (ama && ama.status === "active" && ama.thread_id) {
        const question = message.text;

        const forwardedMsg = await ctx.telegram.forwardMessage(
          adminGroupId,
          message.chat.id,
          message.message_id,
          {
            message_thread_id: ama.thread_id,
          }
        );

        const analysis = await getAnalysis(question, ama.topic);

        let analysisMessage: string;

        if (!analysis) {
          // Handle the case where analysis failed
          analysisMessage = "⚠️ Analysis failed. Please try again later.";

          await ctx.telegram.sendMessage(adminGroupId, analysisMessage, {
            reply_parameters: {
              message_id: forwardedMsg.message_id,
            },
          });
        } else {
          // Normal case when analysis succeeds
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

          // Reply to the fwdMsg in the admin group
          await ctx.telegram.sendMessage(adminGroupId, analysisMessage, {
            reply_parameters: {
              message_id: forwardedMsg.message_id,
            },
            parse_mode: "HTML",
          });
        }

        // Add the score to the database
        const scoreData: ScoreData = {
          amaId: ama.id,
          userId: message.from.id.toString(),
          userName: message.from.first_name || "Unknown",
          question: question,
          originality: analysis?.originality?.score || 0,
          relevance: analysis?.relevance?.score || 0,
          clarity: analysis?.clarity?.score || 0,
          engagement: analysis?.engagement?.score || 0,
          language: analysis?.language?.score || 0,
          score: analysis?.total_score || 0,
        };
        const addScoreToDb = await addScore(scoreData);

        if (addScoreToDb) {
          // React to the initial question message
          await ctx.telegram.callApi("setMessageReaction", {
            chat_id: message.chat.id,
            message_id: message.message_id,
            reaction: [{ type: "emoji", emoji: "👍" as TelegramEmoji }],
          });
        }
      } else {
        await ctx.reply(
          "❌ This AMA is not currently active or has ended. Please check back later."
        );
      }
    }
  }
}
