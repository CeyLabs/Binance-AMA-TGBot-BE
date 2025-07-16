import { Context } from "telegraf";
import { UUID } from "crypto";
import { AMA_COMMANDS, CALLBACK_ACTIONS } from "../ama.constants";
import { AMA, ScoreWithUser, UserDetails, WinnerData } from "../types";
import { getLanguageText } from "../helper/utils";
import {
  getSortedUniqueScores,
  buildWinnerSelectionKeyboard,
  validateScoresExist,
} from "./helper/utils";

export async function handleSelectWinners(
  ctx: Context,
  getAMAsBySessionNo: (sessionNo: number) => Promise<AMA[]>,
  getScoresForAMA: (amaId: UUID) => Promise<ScoreWithUser[]>,
  getWinnersByAMA: (amaId: UUID) => Promise<WinnerData[]>,
  getUserById: (userId: string) => Promise<UserDetails | undefined>,
  winCount?: (userId: string, excludeAmaId?: UUID) => Promise<{ wins: number }>,
): Promise<void> {
  const text = ctx.text;
  if (!text) return void ctx.reply("Invalid command format.");

  // Extract session number from the command
  const match = text
    .replace(new RegExp(`^/${AMA_COMMANDS.SELECT_WINNERS}\\s+`), "")
    .match(/^(\d+)/);
  const sessionNo = match ? parseInt(match[1], 10) : NaN;
  if (!sessionNo || sessionNo <= 0) {
    return void ctx.reply("Invalid session number. Please provide a valid number.");
  }

  console.log(`Selecting winners for AMA session #$${sessionNo}...`); // Debug log

  // Find AMAs matching the session number
  const existingAMAs = await getAMAsBySessionNo(sessionNo);
  if (existingAMAs.length === 0) {
    return void ctx.reply(`No AMA session found for session #${sessionNo}.`);
  }

  // If multiple AMAs found, let user select which one
  if (existingAMAs.length > 1) {
    return void ctx.reply(`Select the community group to select winners for:`, {
      reply_markup: {
        inline_keyboard: [
          existingAMAs.map((ama) => ({
            text: getLanguageText(ama.language),
            callback_data: `${CALLBACK_ACTIONS.SELECT_WINNERS_CMD}_${ama.id}`,
          })),
        ],
      },
    });
  }

  // Otherwise proceed with the single AMA
  const ama = existingAMAs[0];
  await processWinnersSelection(ctx, ama, getScoresForAMA, getWinnersByAMA, getUserById, winCount);
}

export async function selectWinnersByCallback(
  ctx: Context,
  getAMAById: (id: string) => Promise<AMA | null>,
  getScoresForAMA: (amaId: UUID) => Promise<ScoreWithUser[]>,
  getWinnersByAMA: (amaId: UUID) => Promise<WinnerData[]>,
  getUserById: (userId: string) => Promise<UserDetails | undefined>,
  winCount?: (userId: string, excludeAmaId?: UUID) => Promise<{ wins: number }>,
): Promise<void> {
  // Extract AMA ID from callback data
  const callbackData =
    ctx.callbackQuery && "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
  if (!callbackData) {
    return void ctx.answerCbQuery("Missing callback data.");
  }

  const match = callbackData.match(new RegExp(`^${CALLBACK_ACTIONS.SELECT_WINNERS_CMD}_(.+)$`));
  if (!match) {
    return void ctx.answerCbQuery("Invalid callback format.");
  }

  const amaId = match[1] as UUID;
  const ama = await getAMAById(amaId);
  if (!ama) {
    return void ctx.answerCbQuery("AMA session not found.");
  }

  // Process winner selection
  await processWinnersSelection(ctx, ama, getScoresForAMA, getWinnersByAMA, getUserById, winCount);
}

async function processWinnersSelection(
  ctx: Context,
  ama: AMA,
  getScoresForAMA: (amaId: UUID) => Promise<ScoreWithUser[]>,
  getWinnersByAMA: (amaId: UUID) => Promise<WinnerData[]>,
  getUserById: (userId: string) => Promise<UserDetails | undefined>,
  winCount?: (userId: string, excludeAmaId?: UUID) => Promise<{ wins: number }>,
): Promise<void> {
  // Delete the original message if it's a callback
  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  }

  // Check if winners already exist for this AMA
  const existingWinners = await getWinnersByAMA(ama.id);

  if (existingWinners.length > 0) {
    // Get user details for each winner
    const winnerDetails = await Promise.all(
      existingWinners.map(async (winner) => {
        const user = await getUserById(winner.user_id);
        return {
          ...winner,
          user_id: winner.user_id,
          username: user?.username || "Unknown",
          first_name: user?.name || "Unknown",
        };
      }),
    );

    // Format existing winners into a message
    let winnerMessage = `🏆 <b>Winners already selected for Binance Weekly AMA #${ama.session_no}:</b>\n\n`;

    winnerDetails.forEach((winner, index) => {
      const userDisplayName = winner.username
        ? `@${winner.username}`
        : `${winner.first_name} ${winner.first_name}`.trim();

      winnerMessage += `${index + 1}. ${userDisplayName}\n`;
    });

    // Show message with option to force new selection
    return void ctx.reply(winnerMessage, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "✅ Confirm Existing Winners",
              callback_data: `${CALLBACK_ACTIONS.CONFIRM_WINNERS}_${ama.id}`,
            },
            {
              text: "🔄 Force Select New Winners",
              callback_data: `${CALLBACK_ACTIONS.FORCE_SELECT_WINNERS}_${ama.id}`,
            },
          ],
        ],
      },
    });
  } else {
    // No winners yet, proceed with selection flow
    await proceedWithWinnerSelection(ctx, ama, getScoresForAMA, winCount);
  }
}

// Handle force selection callback
export async function forceSelectWinnersCallback(
  ctx: Context,
  getAMAById: (id: string) => Promise<AMA | null>,
  getScoresForAMA: (amaId: UUID) => Promise<ScoreWithUser[]>,
  winCount?: (userId: string, excludeAmaId?: UUID) => Promise<{ wins: number }>,
): Promise<void> {
  const callbackData =
    ctx.callbackQuery && "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
  if (!callbackData) {
    return void ctx.answerCbQuery("Missing callback data.");
  }

  const match = callbackData.match(new RegExp(`^${CALLBACK_ACTIONS.FORCE_SELECT_WINNERS}_(.+)$`));
  if (!match) {
    return void ctx.answerCbQuery("Invalid callback format.");
  }

  const amaId = match[1] as UUID;
  const ama = await getAMAById(amaId);
  if (!ama) {
    return void ctx.answerCbQuery("AMA session not found.");
  }

  await ctx.answerCbQuery("Proceeding with new winner selection...");

  // Delete the original message
  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  }

  // Proceed with selection flow
  await proceedWithWinnerSelection(ctx, ama, getScoresForAMA, winCount);
}

async function proceedWithWinnerSelection(
  ctx: Context,
  ama: AMA,
  getScoresForAMA: (amaId: UUID) => Promise<ScoreWithUser[]>,
  winCount?: (userId: string, excludeAmaId?: UUID) => Promise<{ wins: number }>,
): Promise<void> {
  // Get all scores for winner selection
  const allScores = await getScoresForAMA(ama.id);
  const sortedScores = getSortedUniqueScores(allScores);

  // Validate scores exist
  if (!(await validateScoresExist(sortedScores, ctx, ama.session_no))) {
    return;
  }

  // Build keyboard for winner selection
  const keyboard = await buildWinnerSelectionKeyboard(
    sortedScores,
    ama.id,
    false,
    winCount,
    ama.winner_count,
  );

  await ctx.reply(`🏆 <b>Top 10 Unique Users Scored Best for AMA #${ama.session_no}:</b>`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: keyboard,
    },
  });
}
