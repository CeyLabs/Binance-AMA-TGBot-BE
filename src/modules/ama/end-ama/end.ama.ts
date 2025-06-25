import { UUID } from "crypto";
import { Context } from "telegraf";
import { AMA_COMMANDS, AMA_HASHTAG, CALLBACK_ACTIONS } from "../ama.constants";
import { AMA, GroupInfo, ScoreData } from "../types";
import {
  getLanguageText,
  UUID_PATTERN,
  validateIdPattern,
} from "../helper/utils";

export async function handleEndAMA(
  ctx: Context,
  groupIds: GroupInfo,
  getAMAsBySessionNo: (sessionNo: number) => Promise<AMA[]>,
  updateAMA: (id: UUID, data: Partial<AMA>) => Promise<boolean>,
  getScoresForAMA: (amaId: UUID) => Promise<ScoreData[]>
): Promise<void> {
  const text = ctx.text;
  if (!text) return void ctx.reply("Invalid command format.");

  const match = text
    .replace(new RegExp(`^/${AMA_COMMANDS.END}\\s+`), "")
    .match(/^(\d+)/);
  const sessionNo = match ? parseInt(match[1], 10) : NaN;
  if (!sessionNo || sessionNo <= 0) {
    return void ctx.reply(
      "Invalid session number. Please provide a valid number."
    );
  }

  const existingAMAs = await getAMAsBySessionNo(sessionNo);
  if (existingAMAs.length === 0) {
    return void ctx.reply(
      `No AMA session found for session #${AMA_HASHTAG}${sessionNo}.`
    );
  }

  const availableAMAs = existingAMAs.filter((ama) => ama.status === "active");

  if (availableAMAs.length === 1) {
    return endAMA(ctx, groupIds, availableAMAs[0], updateAMA, getScoresForAMA);
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
  groupIds: GroupInfo,
  getAMAById: (id: string) => Promise<AMA | null>,
  updateAMA: (id: UUID, data: Partial<AMA>) => Promise<boolean>,
  getScoresForAMA: (amaId: UUID) => Promise<ScoreData[]>
): Promise<void> {
  const callbackData =
    ctx.callbackQuery && "data" in ctx.callbackQuery
      ? ctx.callbackQuery.data
      : undefined;
  if (!callbackData) return void ctx.answerCbQuery("Invalid callback data.");

  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.END_AMA}_${UUID_PATTERN}`, "i")
  );
  if (!result) return;

  const ama = await getAMAById(result.id);
  if (!ama) return void ctx.answerCbQuery("AMA session not found.");
  if (ama.status !== "active") return void ctx.reply("AMA session is not active.");

  await endAMA(ctx, groupIds, ama, updateAMA, getScoresForAMA);
}

// Generic function to start an AMA session
async function endAMA(
  ctx: Context,
  groupIds: GroupInfo,
  ama: AMA,
  updateAMA: (id: UUID, data: Partial<AMA>) => Promise<boolean>,
  getScoresForAMA: (amaId: UUID) => Promise<ScoreData[]>
): Promise<void> {

//   await updateAMA(ama.id, {
//     status: "ended",
//   });

  await ctx.reply(`#${AMA_HASHTAG}${ama.session_no} has ended!`);
  await ctx.reply(
    "TODO: CSV need to be generated and sent to the group."
  );

  // Top 10 scores
  const scores = await getScoresForAMA(ama.id);
  console.log("Scores for AMA:", scores);
  if (scores.length > 0) {
    const topScores = scores
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((score, index) => `${index + 1}. ${score.username} - ${score.score}`)
      .join("\n");  
    await ctx.reply(`Top 10 scores:\n${topScores}`);
  } else {
    await ctx.reply("No scores available for this AMA session.");
  }

  // Notify the public group about the AMA start
//   const publicGroupId = groupIds.public[ama.language];
//   const message = `#${AMA_HASHTAG}${ama.session_no} ${getLanguageText(ama.language)} AMA Session has ended!`;
//   await ctx.telegram.sendMessage(publicGroupId, message, {
//     parse_mode: "HTML",
//   });
}
