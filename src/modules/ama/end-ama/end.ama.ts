import { UUID } from "crypto";
import { Context } from "telegraf";
import { AMA_COMMANDS, CALLBACK_ACTIONS, HIDDEN_KEYS } from "../ama.constants";
import {
  AMA,
  BotContext,
  GroupInfo,
  ScoreWithUser,
  WinnerData,
  User,
  SupportedLanguage,
} from "../types";
import {
  getLanguageText,
  UUID_FRAGMENT,
  UUID_PATTERN,
  validateIdPattern,
  delay,
} from "../helper/utils";
import {
  buildWinnersMessage,
  congratsImg,
  getSortedUniqueScores,
  validateCallbackData,
  getDiscardedUserIds,
  getFilteredSortedScores,
  buildWinnerSelectionKeyboard,
  fetchAndValidateAMA,
  getAMAFilteredScores,
  validateScoresExist,
  generateWinnerAnnouncementText,
  generateAndSendCSV,
} from "./helper/utils";
import { DbLoggerService } from "src/logger/db-logger.service";

export async function handleEndAMA(
  ctx: Context,
  getAMAsBySessionNo: (sessionNo: number) => Promise<AMA[]>,
  getScoresForAMA: (amaId: UUID) => Promise<ScoreWithUser[]>,
  winCount?: (userId: string, excludeAmaId?: UUID) => Promise<{ wins: number }>,
): Promise<void> {
  const text = ctx.text;
  if (!text) return void ctx.reply("Invalid command format.");

  const match = text.replace(new RegExp(`^/${AMA_COMMANDS.END}\\s+`), "").match(/^(\d+)/);
  const sessionNo = match ? parseInt(match[1], 10) : NaN;
  if (!sessionNo || sessionNo <= 0) {
    return void ctx.reply("Invalid session number. Please provide a valid number.");
  }

  const existingAMAs = await getAMAsBySessionNo(sessionNo);
  if (existingAMAs.length === 0) {
    return void ctx.reply(`No AMA session found for session #${sessionNo}.`);
  }

  const availableAMAs = existingAMAs.filter((ama) => ama.status === "active");

  if (availableAMAs.length === 1) {
    return selectWinners(ctx, availableAMAs[0], getScoresForAMA, winCount);
  } else if (availableAMAs.length > 1) {
    return void ctx.reply(`Select the community group to End AMA`, {
      reply_markup: {
        inline_keyboard: [
          availableAMAs.map((ama) => ({
            text: getLanguageText(ama.language),
            callback_data: `${CALLBACK_ACTIONS.END_AMA}_${ama.id}`,
          })),
        ],
      },
    });
  }

  return void ctx.reply(`AMA session is not active or has ended.`);
}

export async function endAMAbyCallback(
  ctx: Context,
  getAMAById: (id: string) => Promise<AMA | null>,
  getScoresForAMA: (amaId: UUID) => Promise<ScoreWithUser[]>,
  winCount?: (userId: string, excludeAmaId?: UUID) => Promise<{ wins: number }>,
): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.END_AMA}_${UUID_PATTERN}`, "i"),
  );
  if (!result) return;

  const ama = await getAMAById(result.id);
  if (!ama) return void ctx.answerCbQuery("AMA session not found.");
  if (ama.status !== "active") return void ctx.reply("AMA session is not active.");

  await selectWinners(ctx, ama, getScoresForAMA, winCount);
}

// Generic function to start an AMA session
async function selectWinners(
  ctx: Context,
  ama: AMA,
  getScoresForAMA: (amaId: UUID) => Promise<ScoreWithUser[]>,
  winCount?: (userId: string, excludeAmaId?: UUID) => Promise<{ wins: number }>,
): Promise<void> {
  await ctx.reply(`#${ama.session_no} has ended!`);

  // Get all scores for CSV generation
  const allScores = await getScoresForAMA(ama.id);

  // Delete the original message
  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  }

  // Generate and send CSV file
  if (allScores.length > 0) {
    const loading = await ctx.reply("📊 Generating CSV report...");
    const sendCSV = await generateAndSendCSV(ctx, ama, allScores);

    if (sendCSV?.message_id) {
      await ctx.deleteMessage(loading.message_id);
    } else {
      await ctx.editMessageText("❌ CSV generation failed. Please try again later.");
      return;
    }
  } else {
    await ctx.reply("No scores found to generate CSV report.");
  }

  // Top 10 scores for winner selection
  const sortedScores = getSortedUniqueScores(allScores);

  // Send a message with top users with callback btns
  if (!(await validateScoresExist(sortedScores, ctx, ama.session_no))) {
    return;
  }

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

export async function selectWinnersCallback(
  ctx: Context,
  getAMAById: (id: string) => Promise<AMA | null>,
  getScoresForAMA: (id: UUID) => Promise<ScoreWithUser[]>,
): Promise<void> {
  const callbackData =
    ctx.callbackQuery && "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;

  if (!callbackData) {
    return void ctx.answerCbQuery("Missing callback data.");
  }

  // Inline regex parsing
  const regex = new RegExp(`^${CALLBACK_ACTIONS.SELECT_WINNERS}_${UUID_FRAGMENT}_(\\d+)$`, "i");
  const match = callbackData.match(regex);

  if (!match) {
    return void ctx.answerCbQuery("Invalid callback format.");
  }

  const amaId = match[1] as UUID;
  const winnerCount = parseInt(match[2], 10);

  if (isNaN(winnerCount) || winnerCount <= 0) {
    return void ctx.reply("Invalid winner count specified.");
  }

  const ama = await fetchAndValidateAMA(getAMAById, amaId);
  if (!ama) {
    return void ctx.reply("AMA session not found.");
  }

  const scores = await getScoresForAMA(ama.id);
  if (!(await validateScoresExist(scores, ctx, ama.session_no))) {
    return;
  }

  // De-duplicate by user and keep highest score
  const sortedScores = getSortedUniqueScores(scores);
  const topWinners = sortedScores.slice(0, winnerCount);

  if (topWinners.length === 0) {
    return void ctx.answerCbQuery("No winners found for this AMA session.");
  }

  const winnersText = generateWinnerAnnouncementText(ama, topWinners);

  await ctx.answerCbQuery(`Selected ${topWinners.length} winners for AMA #${ama.session_no}.`);

  await ctx.reply(`${winnersText}`, {
    parse_mode: "HTML",
    reply_markup: {
      // prettier-ignore
      inline_keyboard: [
        [
          {text: "Cancel", callback_data: `${CALLBACK_ACTIONS.CANCEL_WINNERS}_${ama.id}`},
          {text: "Confirm", callback_data: `${CALLBACK_ACTIONS.CONFIRM_WINNERS}_${ama.id}`},
        ],
      ],
    },
  });
}

export async function handleDiscardUser(
  ctx: BotContext,
  getAMAById: (id: UUID) => Promise<AMA | null>,
  getScoresForAMA: (id: UUID) => Promise<ScoreWithUser[]>,
  winCount?: (userId: string, excludeAmaId?: UUID) => Promise<{ wins: number }>,
) {
  if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) {
    await ctx.answerCbQuery("Missing callback data.");
    return;
  }
  const callbackData = ctx.callbackQuery.data;

  const [, userIdStr, amaId] = callbackData.split("_");
  const userId = parseInt(userIdStr, 10);
  const id = amaId as UUID;

  if (isNaN(userId) || !amaId) {
    await ctx.answerCbQuery("Invalid user ID or AMA ID.");
    return;
  }

  // Initialize session structure if needed
  if (!ctx.session.discardedUsersByAMA) {
    ctx.session.discardedUsersByAMA = {};
  }

  if (!ctx.session.discardedUsersByAMA[amaId]) {
    ctx.session.discardedUsersByAMA[amaId] = [];
  }

  const alreadyDiscarded =
    Array.isArray(ctx.session.discardedUsersByAMA[amaId]) &&
    ctx.session.discardedUsersByAMA[amaId].includes(userId);

  if (alreadyDiscarded) {
    await ctx.answerCbQuery("User already discarded 🚫");
    return;
  }

  // Add to discard list
  const discardedUsers = (ctx.session.discardedUsersByAMA?.[amaId] ?? []) as number[];
  if (Array.isArray(discardedUsers)) {
    discardedUsers.push(userId);
    ctx.session.discardedUsersByAMA[amaId] = discardedUsers;
  } else {
    ctx.session.discardedUsersByAMA[amaId] = [userId];
  }

  const ama = await fetchAndValidateAMA(getAMAById, id);
  if (!ama) {
    return void ctx.answerCbQuery("AMA session not found.");
  }

  const discardedUserIds = getDiscardedUserIds(ctx, id);
  const filteredScores = await getAMAFilteredScores(getScoresForAMA, id, discardedUserIds);

  const keyboard = await buildWinnerSelectionKeyboard(
    filteredScores,
    ama.id,
    true,
    winCount,
    ama.winner_count,
  );

  await ctx.editMessageReplyMarkup({
    inline_keyboard: keyboard,
  });

  await ctx.answerCbQuery("User discarded ✅");
}

// on reset should reset the discarded users and update the callback buttons to reflect the new state
export async function resetWinnersCallback(
  ctx: BotContext,
  getAMAById: (id: UUID) => Promise<AMA | null>,
  getScoresForAMA: (id: UUID) => Promise<ScoreWithUser[]>,
  winCount?: (userId: string, excludeAmaId?: UUID) => Promise<{ wins: number }>,
): Promise<void> {
  const result = await validateCallbackData(ctx, CALLBACK_ACTIONS.RESET_WINNERS);
  if (!result) return;

  const { amaId } = result;
  const ama = await fetchAndValidateAMA(getAMAById, amaId);
  if (!ama) {
    return void ctx.reply("AMA session not found.");
  }

  // Reset discarded users for this AMA
  if (ctx.session.discardedUsersByAMA?.[amaId]) {
    delete ctx.session.discardedUsersByAMA[amaId];
  }

  // Fetch scores again after reset
  const scores = await getScoresForAMA(ama.id);
  if (scores.length === 0) {
    return void ctx.answerCbQuery("No scores found for this AMA session.");
  }

  const discardedUserIds = getDiscardedUserIds(ctx, amaId);
  const filteredScores = getFilteredSortedScores(scores, discardedUserIds);

  const keyboard = await buildWinnerSelectionKeyboard(
    filteredScores,
    ama.id,
    false,
    winCount,
    ama.winner_count,
  );

  await ctx.editMessageReplyMarkup({
    inline_keyboard: keyboard,
  });

  await ctx.answerCbQuery("Winners reset successfully.");
}

export async function confirmWinnersCallback(
  ctx: BotContext,
  getAMAById: (id: UUID) => Promise<AMA | null>,
  getScoresForAMA: (id: UUID) => Promise<ScoreWithUser[]>,
  addWinner: (
    ama_id: UUID,
    user_id: string,
    message_id: UUID,
    rank: number,
  ) => Promise<WinnerData | null>,
  updateAMA: (id: UUID, updates: Partial<AMA>) => Promise<AMA | null>,
  deleteWinnersByAMA: (amaId: UUID) => Promise<boolean>,
  logger?: DbLoggerService,
): Promise<void> {
  const result = await validateCallbackData(ctx, CALLBACK_ACTIONS.CONFIRM_WINNERS);
  if (!result) return;

  const { amaId } = result;
  const ama = await fetchAndValidateAMA(getAMAById, amaId);
  if (!ama) {
    return void ctx.reply("AMA session not found.");
  }

  const discardedUserIds = getDiscardedUserIds(ctx, amaId);
  const filteredScores = await getAMAFilteredScores(getScoresForAMA, ama.id, discardedUserIds);

  if (filteredScores.length === 0) {
    return void ctx.reply("No winners found for this AMA session.");
  }

  const topWinners = filteredScores.slice(0, ama.winner_count);

  // End the AMA session
  await updateAMA(ama.id, {
    status: "ended",
  });

  logger?.log(`AMA #${ama.session_no} ended and winners confirmed.`, ctx.from?.id?.toString());

  // Delete existing winners for this AMA
  const deleted = await deleteWinnersByAMA(ama.id);
  if (!deleted) {
    console.warn(`No winners were deleted for AMA #${ama.id}.`);
  }

  // Add winners to database
  try {
    for (let i = 0; i < topWinners.length; i++) {
      const winner = topWinners[i];
      await addWinner(ama.id, winner.user_id, winner.id, i + 1);
    }
  } catch (error) {
    console.error("Error adding winners to database:", error);
    logger?.error(
      `Error adding winners to AMA #${ama.session_no}: ${(error as Error).message}`,
      ctx.from?.id?.toString(),
    );
    // If there's an error, we can still notify the user
    return void ctx.reply("Error saving winners to database. Please try again.");
  }

  const message = buildWinnersMessage(ama, topWinners, true); // Show scores in admin message

  await ctx.sendPhoto(congratsImg, {
    caption: message,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "Cancel", callback_data: `${CALLBACK_ACTIONS.CANCEL_WINNERS}_${ama.id}` },
          {
            text: "Schedule Broadcast",
            callback_data: `${CALLBACK_ACTIONS.SCHEDULE_WINNERS_BROADCAST}_${ama.id}`,
          },
        ],
        [
          {
            text: "Broadcast Now",
            callback_data: `${CALLBACK_ACTIONS.BROADCAST_WINNERS}_${ama.id}`,
          },
        ],
      ],
    },
  });

  // Delete the original message that allows discarding winners
  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  }
}

export async function handleWinnersBroadcast(
  ctx: Context,
  getAMAById: (id: UUID) => Promise<AMA>,
  getWinnersWithUserDetails: (amaId: UUID) => Promise<ScoreWithUser[]>,
  groupIds: GroupInfo,
  getSubscribedUsers: (lang: SupportedLanguage) => Promise<User[]>,
): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.BROADCAST_WINNERS}_${UUID_PATTERN}`, "i"),
  );
  if (!result) return;

  const id = result.id;
  const ama = await getAMAById(id);

  if (!ama) {
    return void ctx.reply("AMA session not found.");
  }

  const winners = await getWinnersWithUserDetails(ama.id);
  if (winners.length === 0) {
    return void ctx.reply("No winners found for this AMA session.");
  }

  const message = buildWinnersMessage(ama, winners, false); // Don't show scores in public message

  const publicGroupId = groupIds.public[ama.language];

  const reminderUrl = `https://t.me/${process.env.BOT_USERNAME}?start=${
    ama.language === "ar" ? HIDDEN_KEYS.SUBSCRIBE_AR : HIDDEN_KEYS.SUBSCRIBE_EN
  }`;
  const inlineKeyboard =
    ama.language === "ar"
      ? [[{ text: "قم بتعيين تذكير للمحاثة القادمة ⏰", url: reminderUrl }]]
      : [[{ text: "⏰ Set a reminder for the next AMA", url: reminderUrl }]];

  const broadcastToPublic = await ctx.telegram.sendPhoto(publicGroupId, congratsImg, {
    caption: message,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: inlineKeyboard,
    },
  });

  // Pin the congratulation message in the public group
  if (broadcastToPublic.message_id) {
    const subscribers = await getSubscribedUsers(ama.language);
    for (const user of subscribers) {
      try {
        await ctx.telegram.sendPhoto(user.user_id, congratsImg, {
          caption: message,
          parse_mode: "HTML",
        });
      } catch (err) {
        console.error(`Failed to send winners to ${user.user_id}:`, err);
      }
      await delay(200);
    }
    try {
      await ctx.telegram.pinChatMessage(publicGroupId, broadcastToPublic.message_id);
    } catch (error) {
      console.error("Error pinning winner announcement:", error);
    }
  }

  // Remove the callback buttons from the message
  if (ctx.callbackQuery && ctx.callbackQuery.message && broadcastToPublic) {
    await ctx.editMessageReplyMarkup({
      inline_keyboard: [],
    });
  }

  if (broadcastToPublic.message_id) {
    return void ctx.reply("Winners broadcasted successfully to the public group.");
  } else {
    return void ctx.reply("Failed to broadcast winners to the public group.");
  }
}

export async function cancelWinnersCallback(
  ctx: BotContext,
  getAMAById: (id: UUID) => Promise<AMA | null>,
): Promise<void> {
  const result = await validateCallbackData(ctx, CALLBACK_ACTIONS.CANCEL_WINNERS);
  if (!result) return;

  const { amaId } = result;
  const ama = await fetchAndValidateAMA(getAMAById, amaId);
  if (!ama) {
    return void ctx.reply("AMA session not found.");
  }

  // Reset discarded users for this AMA if any
  if (ctx.session.discardedUsersByAMA?.[amaId]) {
    delete ctx.session.discardedUsersByAMA[amaId];
  }

  await ctx.answerCbQuery("Winner selection cancelled.");
  await ctx.reply(`Winner selection for AMA #${ama.session_no} has been cancelled.`);

  // Edit the confirmation message by removing the buttons
  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    await ctx.editMessageReplyMarkup({
      inline_keyboard: [],
    });
  }
}
