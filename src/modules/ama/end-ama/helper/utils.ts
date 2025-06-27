import { UUID } from "crypto";
import { AMA, ScoreData, ScoreWithUser, BotContext } from "../../types";
import * as dayjs from "dayjs";
import { CALLBACK_ACTIONS } from "../../ama.constants";
import { UUID_PATTERN } from "../../helper/utils";
import { Context } from "telegraf";
import { generateAMAScoresCSV, cleanupCSVFile } from "./csv-utils";
import * as fs from "fs";

//prettier-ignore
export const placeEmojis = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

export const congratsImg =
  "https://a.dropoverapp.com/cloud/download/002b40b8-631c-4431-8f4b-5b8a977f4cd3/29e8d620-b2fe-4159-bb05-412c491f8b9f";

export function getSortedUniqueScores(
  scores: ScoreWithUser[]
): ScoreWithUser[] {
  const uniqueScores = scores.reduce(
    (acc, current) => {
      const uid = String(current.user_id);
      if (!acc[uid] || acc[uid].score < current.score) {
        acc[uid] = current;
      }
      return acc;
    },
    {} as Record<string, ScoreWithUser>
  );

  return Object.values(uniqueScores).sort((a, b) => b.score - a.score);
}

/**
 * Extract callback data validation logic
 */
export function validateCallbackData(
  ctx: Context,
  action: string
): { callbackData: string; amaId: UUID } | null {
  const callbackData =
    ctx.callbackQuery && "data" in ctx.callbackQuery
      ? ctx.callbackQuery.data
      : undefined;

  if (!callbackData) {
    ctx.answerCbQuery("Missing callback data.");
    return null;
  }

  const regex = new RegExp(`^${action}_${UUID_PATTERN}`, "i");
  const match = callbackData.match(regex);

  if (!match) {
    ctx.answerCbQuery("Invalid callback format.");
    return null;
  }

  return {
    callbackData,
    amaId: match[1] as UUID,
  };
}

/**
 * Get discarded user IDs from session
 */
export function getDiscardedUserIds(ctx: BotContext, amaId: UUID): Set<number> {
  return new Set((ctx.session?.discardedUsersByAMA?.[amaId] ?? []).map(Number));
}

/**
 * Filter scores by removing discarded users
 */
export function getFilteredSortedScores(
  scores: ScoreWithUser[],
  discardedUserIds: Set<number>
): ScoreWithUser[] {
  const sortedScores = getSortedUniqueScores(scores);
  return sortedScores.filter(
    (score) => !discardedUserIds.has(Number(score.user_id))
  );
}

/**
 * Generate the display text for a user's place and score
 */
export function getUserDisplayText(
  user: ScoreWithUser,
  index: number
): { place: string; scoreDisplay: string } {
  const place = `${(index + 1).toString().padStart(2, "0")}.`;
  const scoreDisplay = ` - Score: ${user.score}`;

  return { place, scoreDisplay };
}

/**
 * Build winner selection keyboard with past winner indicators
 */
export async function buildWinnerSelectionKeyboard(
  scores: ScoreWithUser[],
  amaId: UUID,
  showResetButton = false,
  isUserWinner?: (userId: string) => Promise<{ bool: boolean }>
): Promise<any[][]> {
  const keyboard: any[][] = [];

  // Build keyboard rows for each user
  for (let index = 0; index < Math.min(scores.length, 10); index++) {
    const user = scores[index];
    const { place, scoreDisplay } = getUserDisplayText(user, index);

    let displayText = `${place} ${user.username}${scoreDisplay}`;

    // Check if user is a past winner (if function is provided)
    if (isUserWinner) {
      try {
        const { bool: isPastWinner } = await isUserWinner(user.user_id);
        if (isPastWinner) {
          displayText += " 🏁";
        }
      } catch (error) {
        console.error("Error checking past winner status:", error);
      }
    }

    // prettier-ignore
    keyboard.push([
      {text: displayText, callback_data: "noop"},
      {text: "❌", callback_data: `${CALLBACK_ACTIONS.DISCARD_WINNER}_${user.user_id}_${amaId}`},
    ]);
  }

  // Add confirm button
  keyboard.push([
    {
      text: `✅ Confirm top ${scores.length} winners`,
      callback_data: `${CALLBACK_ACTIONS.CONFIRM_WINNERS}_${amaId}`,
    },
  ]);

  // Add reset button if needed
  if (showResetButton) {
    keyboard.push([
      {
        text: "Reset",
        callback_data: `${CALLBACK_ACTIONS.RESET_WINNERS}_${amaId}`,
      },
    ]);
  }

  return keyboard;
}

/**
 * Fetch AMA and validate it exists and is active (for some operations)
 */
export async function fetchAndValidateAMA(
  getAMAById: (id: UUID) => Promise<AMA | null>,
  amaId: UUID,
  requireActive = false
): Promise<AMA | null> {
  const ama = await getAMAById(amaId);

  if (!ama) {
    return null;
  }

  if (requireActive && ama.status !== "active") {
    return null;
  }

  return ama;
}

/**
 * Get filtered scores for an AMA with discarded users removed
 */
export async function getAMAFilteredScores(
  getScoresForAMA: (amaId: UUID) => Promise<ScoreWithUser[]>,
  amaId: UUID,
  discardedUserIds: Set<number>
): Promise<ScoreWithUser[]> {
  const scores = await getScoresForAMA(amaId);
  return getFilteredSortedScores(scores, discardedUserIds);
}

export function buildWinnersMessage(
  ama: AMA,
  winners: ScoreWithUser[]
): string {
  const sessionDate = ama.created_at
    ? dayjs(ama.created_at).format("MMMM D")
    : "Unknown Date";

  const winnersText = winners
    .map((user, i) => {
      const emoji = placeEmojis[i] || `${i + 1}.`;
      return `${emoji} <b>${user.username}</b> - Score: ${user.score}`;
    })
    .join("\n");

  return [
    `🏆 <b>Congratulations to the winners in our Binance Weekly Session #${ama.session_no} - ${sessionDate}</b>\n`,
    `🔶 ${ama.reward} was sent to each eligible winner based on the contest terms.\n`,
    `🔶 The list of winners is here-below and good luck to everyone in the upcoming AMA session\n`,
    `🎁 <b>Eligible winners:</b>\n`,
    winnersText,
    `\n🎉 We look forward to your future participation in the Binance Weekly Sessions.`,
  ].join("\n");
}

/**
 * Validate that scores exist for an AMA
 */
export function validateScoresExist(
  scores: ScoreWithUser[],
  ctx: Context,
  amaSessionNo: number
): boolean {
  if (scores.length === 0) {
    ctx.reply(`No scores found for AMA #${amaSessionNo}.`);
    return false;
  }
  return true;
}

/**
 * Generate winner announcement text with medals
 */
export function generateWinnerAnnouncementText(
  ama: AMA,
  winners: ScoreWithUser[]
): string {
  return [
    `🎯 <b>Winners Selected for AMA #${ama.session_no}:</b>\n`,
    ...winners.map((winner, index) => {
      const emoji = placeEmojis[index] || `${index + 1}.`;
      return `${emoji} <b>${winner.username}</b> - Score: ${winner.score}`;
    }),
    `\n🔔 Click below to officially announce them`,
  ].join("\n");
}

/**
 * Generate and send CSV file with AMA scores
 */
export async function generateAndSendCSV(
  ctx: Context,
  ama: AMA,
  scores: ScoreWithUser[]
): Promise<void> {
  try {
    // Generate CSV file
    const csvFilePath = await generateAMAScoresCSV(ama, scores);

    // Check if file was created successfully
    if (!fs.existsSync(csvFilePath)) {
      throw new Error("CSV file was not created");
    }

    // Send the CSV file using file path
    await ctx.replyWithDocument(
      { source: csvFilePath },
      {
        caption:
          `📊 AMA #${ama.session_no} Scores Report\n\n` +
          `📅 Date: ${dayjs(ama.created_at).format("MMMM D, YYYY")}\n` +
          `🌐 Language: ${ama.language.toUpperCase()}\n` +
          `📝 Topic: ${ama.topic}\n`,
        parse_mode: "HTML",
      }
    );

    // Clean up the temporary file
    setTimeout(() => {
      cleanupCSVFile(csvFilePath);
    }, 5000); // Clean up after 5 seconds
  } catch (error) {
    console.error("Error generating or sending CSV:", error);
    await ctx.reply(
      "❌ Failed to generate CSV report. Please try again later."
    );
  }
}
