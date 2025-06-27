import { UUID } from "crypto";
import { AMA, ScoreData, BotContext } from "../types";
import * as dayjs from "dayjs";
import { CALLBACK_ACTIONS } from "../ama.constants";
import { UUID_PATTERN } from "../helper/utils";
import { Context } from "telegraf";

//prettier-ignore
export const placeEmojis = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

export const congratsImg =
  "https://a.dropoverapp.com/cloud/download/002b40b8-631c-4431-8f4b-5b8a977f4cd3/29e8d620-b2fe-4159-bb05-412c491f8b9f";

export function getSortedUniqueScores(scores: ScoreData[]): ScoreData[] {
  const uniqueScores = scores.reduce(
    (acc, current) => {
      const uid = String(current.user_id);
      if (!acc[uid] || acc[uid].score < current.score) {
        acc[uid] = current;
      }
      return acc;
    },
    {} as Record<string, ScoreData>
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
  scores: ScoreData[],
  discardedUserIds: Set<number>
): ScoreData[] {
  const sortedScores = getSortedUniqueScores(scores);
  return sortedScores.filter(
    (score) => !discardedUserIds.has(Number(score.user_id))
  );
}

/**
 * Generate medals for a given index
 */
export function getMedals(index: number): string {
  return index === 1 ? " 🥈🌟" : index === 2 ? " 🥉🌟" : "";
}

/**
 * Generate the display text for a user's place and score
 */
export function getUserDisplayText(
  user: ScoreData,
  index: number
): { place: string; scoreDisplay: string } {
  const place = `${(index + 1).toString().padStart(2, "0")}.`;
  const medals = getMedals(index);
  const scoreDisplay = ` - Score: ${user.score}${medals}`;

  return { place, scoreDisplay };
}

/**
 * Build winner selection keyboard
 */
export function buildWinnerSelectionKeyboard(
  scores: ScoreData[],
  amaId: UUID,
  showResetButton = false
): any[][] {
  const keyboard = [
    ...scores.slice(0, 10).map((user, index) => {
      const { place, scoreDisplay } = getUserDisplayText(user, index);
      return [
        {
          text: `${place} ${user.username}${scoreDisplay}`,
          callback_data: "noop",
        },
        {
          text: "❌",
          callback_data: `${CALLBACK_ACTIONS.DISCARD_WINNER}_${user.user_id}_${amaId}`,
        },
      ];
    }),
    [
      {
        text: `✅ Confirm top ${scores.length} winners`,
        callback_data: `${CALLBACK_ACTIONS.CONFIRM_WINNERS}_${amaId}`,
      },
    ],
  ];

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
  getScoresForAMA: (amaId: UUID) => Promise<ScoreData[]>,
  amaId: UUID,
  discardedUserIds: Set<number>
): Promise<ScoreData[]> {
  const scores = await getScoresForAMA(amaId);
  return getFilteredSortedScores(scores, discardedUserIds);
}

export function formatWinnersList(
  winners: ScoreData[],
  showMedals = true
): string {
  return winners
    .map((winner, index) => {
      const emoji = placeEmojis[index] || `${index + 1}.`;
      const medals = showMedals && index < 3 ? " 🎖️" : "";
      return `${emoji} <b>${winner.username}</b> - Score: ${winner.score}${medals}`;
    })
    .join("\n");
}

export function buildWinnersMessage(ama: AMA, winners: ScoreData[]): string {
  const sessionDate = ama.created_at
    ? dayjs(ama.created_at).format("MMMM D")
    : "Unknown Date";

  const winnersText = winners
    .map((user, i) => {
      const emoji = placeEmojis[i] || `${i + 1}.`;
      const medal = i < 3 ? " 🌟" : "";
      return `${emoji} <b>${user.username}</b> - Score: ${user.score}${medal}`;
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
  scores: ScoreData[],
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
  winners: ScoreData[]
): string {
  return [
    `🎯 <b>Winners Selected for AMA #${ama.session_no}:</b>\n`,
    ...winners.map((winner, index) => {
      const emoji = placeEmojis[index] || `${index + 1}.`;
      const medals = index < 3 ? " 🌟".repeat(1 + (2 - index)) : "";
      return `${emoji} <b>${winner.username}</b> - Score: ${winner.score}${medals}`;
    }),
    `\n🔔 Click below to officially announce them`,
  ].join("\n");
}
