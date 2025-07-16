import { UUID } from "crypto";
import { BotContext, AMA, WinnerData } from "../types";
import { CALLBACK_ACTIONS, HIDDEN_KEYS } from "../ama.constants";

/**
 * Handle /start command with deep links for claiming rewards
 */
export async function handleStart(
  ctx: BotContext,
  getAMAById: (id: UUID) => Promise<AMA | null>,
  getWinnersByAMA: (amaId: UUID) => Promise<WinnerData[]>,
  subscribeUser: (userId: string, lang: "en" | "ar") => Promise<void>,
): Promise<void> {
  const messageText = ctx.text || "";
  const args = messageText.split(" ");

  if (
    args &&
    args.length > 1 &&
    (args[1] === HIDDEN_KEYS.SUBSCRIBE_EN || args[1] === HIDDEN_KEYS.SUBSCRIBE_AR)
  ) {
    const userId = ctx.from?.id?.toString();
    if (userId) {
      const lang = args[1] === HIDDEN_KEYS.SUBSCRIBE_AR ? "ar" : "en";
      await subscribeUser(userId, lang);
      await ctx.reply(
        lang === "ar"
          ? "✅ سيتم إرسال إعلانات AMA العربية هنا."
          : "✅ You will now receive English AMA announcements here.",
      );
    }
    return;
  }

  // Check if this is a claim reward deep link
  if (args && args.length > 1 && args[1].startsWith(`${CALLBACK_ACTIONS.CLAIM_REWARD}_`)) {
    const amaId = args[1].replace(`${CALLBACK_ACTIONS.CLAIM_REWARD}_`, "") as UUID;

    try {
      const ama = await getAMAById(amaId);
      if (!ama) {
        return void ctx.reply("❌ AMA session not found.");
      }

      const userId = ctx.from?.id?.toString();
      if (!userId) {
        return void ctx.reply("❌ Unable to identify user.");
      }

      // Check if user is a winner for this specific AMA
      const winners = await getWinnersByAMA(amaId);
      const isWinner = winners.some((winner) => winner.user_id === userId);

      if (isWinner) {
        // User is a winner, send the form link
        await ctx.reply(
          `🎉 Congratulations! You are a winner for AMA #${ama.session_no}!\n\n` +
            `Please claim your reward using the link below:`,
          {
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: "🎁 Open Claim Form",
                    url: ama.form_link,
                  },
                ],
              ],
            },
          },
        );
      } else {
        // User is not a winner
        await ctx.reply(
          `❌ You are not a winner for AMA #${ama.session_no}.\n\n` +
            `Only winners can claim rewards for this session.`,
        );
      }
    } catch (error) {
      console.error("Error processing claim:", error);
      await ctx.reply("❌ Error processing your claim. Please try again later.");
    }
  } else {
    // Regular start command
    await ctx.reply(
      "👋 Welcome to Binance Weekly AMA Bot!\n\n" +
        "I help manage AMA sessions and track participant scores.\n\n" +
        "Use the following commands:\n" +
        "• /newama - Create a new AMA session\n" +
        "• /startama - Start an existing AMA session\n" +
        "• /endama - End an AMA session and select winners",
    );
  }
}
