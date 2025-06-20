import { Context } from "telegraf";
import { AMA_HASHTAG } from "../ama.constants";
import { AMA, OpenAIAnalysis } from "../types";

export async function handleAMAQuestion(
  ctx: Context,
  adminGroupId: string,
  getAMAByHashtag: (hashtag: string) => Promise<AMA | null>,
  getAnalysis: (
    question: string,
    topic?: string
  ) => Promise<OpenAIAnalysis | null>
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

        // ✅ Copy the message into the admin group thread instead of forward
        const result = await ctx.telegram.sendMessage(
          adminGroupId,
          `📝 *Question from:* [${message.from.first_name}](tg://user?id=${message.from.id})\n\n${question}`,
          {
            parse_mode: "Markdown",
            message_thread_id: ama.thread_id,
          }
        );

        const forwardedMsgId = result.message_id;

        const analysis = await getAnalysis(question, ama.topic);

        const analysisMessage = 
`<b>📊 AI Analysis</b>\n\n` +
`<b>✨ Originality:</b> ${analysis?.originality?.score}/10\n` +
`<i>${analysis?.originality?.comment}</i>\n\n` +
`<b>🎯 Relevance:</b> ${analysis?.relevance?.score}/10\n` +
`<i>${analysis?.relevance?.comment}</i>\n\n` +
`<b>🔍 Clarity:</b> ${analysis?.clarity?.score}/10\n` +
`<i>${analysis?.clarity?.comment}</i>\n\n` +
`<b>📢 Engagement:</b> ${analysis?.engagement?.score}/10\n` +
`<i>${analysis?.engagement?.comment}</i>\n\n` +
`<b>✍️ Language:</b> ${analysis?.language?.score}/10\n` +
`<i>${analysis?.language?.comment}</i>\n\n` +
`<b>🏁 Total Score:</b> <b>${analysis?.total_score}/50</b>`;

        // ✅ Now reply to the copied message
        await ctx.telegram.sendMessage(adminGroupId, analysisMessage, {
          reply_parameters: {
            message_id: forwardedMsgId,
          },
          parse_mode: "HTML",
        });
      }
    }
  }
}
