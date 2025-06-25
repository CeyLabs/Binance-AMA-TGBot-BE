import { UUID } from "crypto";
import { Context } from "telegraf";
import { AMA_COMMANDS, AMA_HASHTAG, CALLBACK_ACTIONS } from "../ama.constants";
import { AMA, GroupInfo, ScoreData } from "../types";
import {
  getLanguageText,
  UUID_FRAGMENT,
  UUID_PATTERN,
  validateIdPattern,
} from "../helper/utils";
import * as dayjs from "dayjs";

//prettier-ignore
const placeEmojis = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

const congratsImg =
  "https://a.dropoverapp.com/cloud/download/002b40b8-631c-4431-8f4b-5b8a977f4cd3/29e8d620-b2fe-4159-bb05-412c491f8b9f";

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
    return selectWinners(
      ctx,
      groupIds,
      availableAMAs[0],
      updateAMA,
      getScoresForAMA
    );
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
  if (ama.status !== "active")
    return void ctx.reply("AMA session is not active.");

  await selectWinners(ctx, groupIds, ama, updateAMA, getScoresForAMA);
}

// Generic function to start an AMA session
async function selectWinners(
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
  await ctx.reply("TODO: CSV need to be generated and sent to the group.");

  // Top 10 scores
  const scores = await getScoresForAMA(ama.id);

  // Group scores by username and keep highest score
  const uniqueScores = scores.reduce(
    (acc, current) => {
      const uid = String(current.user_id); // Normalize to string
      if (!acc[uid] || acc[uid].score < current.score) {
        acc[uid] = current;
      }
      return acc;
    },
    {} as Record<string, ScoreData>
  );

  const sortedScores = Object.values(uniqueScores).sort(
    (a, b) => b.score - a.score
  );

  // Create array of 10 entries, fill empty slots with placeholder
  const topScores = Array(10)
    .fill(null)
    .map((_, index) => {
      if (index < sortedScores.length) {
        return `${index + 1}. ${sortedScores[index].username} - ${sortedScores[index].score}`;
      }
      return `${index + 1}. N/A - 0`;
    })
    .join("\n");

  await ctx.reply(
    `🏆 Top 10 users with Multiple Questions for AMA #${ama.session_no}\n\n${topScores}`,
    {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `Select top ${ama.winner_count} winners`,
              callback_data: `${CALLBACK_ACTIONS.SELECT_WINNERS}_${ama.id}_${ama.winner_count}`,
            },
          ],
        ],
      },
    }
  );

  // Notify the public group about the AMA start
  //   const publicGroupId = groupIds.public[ama.language];
  //   const message = `#${AMA_HASHTAG}${ama.session_no} ${getLanguageText(ama.language)} AMA Session has ended!`;
  //   await ctx.telegram.sendMessage(publicGroupId, message, {
  //     parse_mode: "HTML",
  //   });
}

export async function selectWinnersCallback(
  ctx: Context,
  getAMAById: (id: string) => Promise<AMA | null>,
  getScoresForAMA: (id: UUID) => Promise<ScoreData[]>
): Promise<void> {
  const callbackData =
    ctx.callbackQuery && "data" in ctx.callbackQuery
      ? ctx.callbackQuery.data
      : undefined;

  if (!callbackData) {
    return void ctx.answerCbQuery("Missing callback data.");
  }

  // Inline regex parsing
  const regex = new RegExp(
    `^${CALLBACK_ACTIONS.SELECT_WINNERS}_${UUID_FRAGMENT}_(\\d+)$`,
    "i"
  );
  const match = callbackData.match(regex);

  if (!match) {
    return void ctx.answerCbQuery("Invalid callback format.");
  }

  const amaId = match[1] as UUID;
  const winnerCount = parseInt(match[2], 10);

  if (isNaN(winnerCount) || winnerCount <= 0) {
    return void ctx.reply("Invalid winner count specified.");
  }

  const ama = await getAMAById(amaId);
  if (!ama) {
    return void ctx.reply("AMA session not found.");
  }

  const scores = await getScoresForAMA(ama.id);
  if (scores.length === 0) {
    return void ctx.answerCbQuery("No scores found for this AMA session.");
  }

  // De-duplicate by user and keep highest score
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

  const sortedScores = Object.values(uniqueScores).sort(
    (a, b) => b.score - a.score
  );

  const topWinners = sortedScores.slice(0, winnerCount);
  if (topWinners.length === 0) {
    return void ctx.answerCbQuery("No winners found for this AMA session.");
  }

  const winnersText = [
    `🎯 <b>Winners Selected for AMA #${ama.session_no}:</b>\n`,
    ...topWinners.map((winner, index) => {
      const emoji = placeEmojis[index] || `${index + 1}.`;
      const medals = index < 3 ? " 🌟".repeat(1 + (2 - index)) : "";
      return `${emoji} <b>${winner.username}</b> - Score: ${winner.score}${medals}`;
    }),
    `\n🔔 Click below to officially announce them`,
  ].join("\n");

  await ctx.answerCbQuery(
    `Selected ${topWinners.length} winners for AMA #${ama.session_no}.`
  );

  await ctx.reply(`${winnersText}`, {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "Cancel",
            callback_data: `${CALLBACK_ACTIONS.CANCEL_WINNERS}s_${ama.id}`,
          },
          {
            text: "Confirm",
            callback_data: `${CALLBACK_ACTIONS.CONFIRM_WINNERS}_${ama.id}`,
          },
        ],
      ],
    },
  });
}

export async function confirmWinnersCallback(
  ctx: Context,
  getAMAById: (id: UUID) => Promise<AMA | null>,
  getScoresForAMA: (id: UUID) => Promise<ScoreData[]>
): Promise<void> {
  const callbackData =
    ctx.callbackQuery && "data" in ctx.callbackQuery
      ? ctx.callbackQuery.data
      : undefined;

  if (!callbackData) {
    return void ctx.answerCbQuery("Missing callback data.");
  }

  const regex = new RegExp(
    `^${CALLBACK_ACTIONS.CONFIRM_WINNERS}_${UUID_FRAGMENT}$`,
    "i"
  );
  const match = callbackData.match(regex);

  if (!match) {
    return void ctx.answerCbQuery("Invalid callback format.");
  }

  const amaId = match[1] as UUID;
  const ama = await getAMAById(amaId);
  if (!ama) {
    return void ctx.reply("AMA session not found.");
  }

  const scores = await getScoresForAMA(ama.id);
  if (scores.length === 0) {
    return void ctx.reply("No winners found for this AMA session.");
  }

  // De-duplicate by user and keep highest score
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

  const sortedScores = Object.values(uniqueScores).sort(
    (a, b) => b.score - a.score
  );

  const topWinners = sortedScores.slice(0, 5); // Display top 5 only

  const sessionDate = ama.created_at
    ? dayjs(ama.created_at).format("MMMM D")
    : "Unknown Date";

  const winnersList = topWinners
    .map((winner, index) => {
      const emoji = placeEmojis[index] || `${index + 1}.`;
      const medals = index < 3 ? " 🎖️" : "";
      return `${emoji} <b>${winner.username}</b> - Score: ${winner.score}${medals}`;
    })
    .join("\n");

  const message = [
    `🏆 <b>Congratulations to the winners in our Binance Weekly Session #${ama.session_no} - ${sessionDate}</b>\n`,
    `🔶 ${ama.reward} was sent to each eligible winner based on the contest terms.\n`,
    `🔶 The list of winners is here-below and good luck to everyone in the upcoming AMA session\n`,
    `🎁 <b>Eligible winners:</b>\n`,
    winnersList,
    `\n🎉 We look forward to your future participation in the Binance Weekly Sessions.`,
  ].join("\n");

  await ctx.sendPhoto(congratsImg, {
    caption: message,
    parse_mode: "HTML",
    reply_markup: {
      // prettier-ignore
      inline_keyboard: [
        [
          { text: "Cancel", callback_data: `${CALLBACK_ACTIONS.CANCEL_WINNERS}_${ama.id}` },
          { text: "Broadcast Now", callback_data: `${CALLBACK_ACTIONS.BROADCAST_WINNERS}_${ama.id}` },
        ],
      ],
    },
  });
}

export async function handleWiinersBroadcast(
  ctx: Context,
  getAMAById: (id: UUID) => Promise<AMA>,
  updateAMA: (id: UUID, data: Partial<AMA>) => Promise<boolean>,
  getScoresForAMA: (amaId: UUID) => Promise<ScoreData[]>,
  groupIds: GroupInfo
): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.BROADCAST_WINNERS}_${UUID_PATTERN}`, "i")
  );
  if (!result) return;

  const id = result.id;
  console.log("Selected AMA ID:", id);
  const ama = await getAMAById(id);
  console.log("AMA retrieved:", ama);
  if (!ama) {
    return void ctx.reply("AMA session not found.");
  }

  const scores = await getScoresForAMA(ama.id);
  console.log("Scores retrieved:", scores);
  if (scores.length === 0) {
    return void ctx.reply("No winners found for this AMA session.");
  }

  // De-duplicate by user and keep highest score
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

  const sortedScores = Object.values(uniqueScores).sort(
    (a, b) => b.score - a.score
  );

  const topWinners = sortedScores.slice(0, 5); // Display top 5 only

  const sessionDate = ama.created_at
    ? dayjs(ama.created_at).format("MMMM D")
    : "Unknown Date";

  const winnersList = topWinners
    .map((winner, index) => {
      const emoji = placeEmojis[index] || `${index + 1}.`;
      const medals = index < 3 ? " 🎖️" : "";
      return `${emoji} <b>${winner.username}</b> - Score: ${winner.score}${medals}`;
    })
    .join("\n");

  const message = [
    `🏆 <b>Congratulations to the winners in our Binance Weekly Session #${ama.session_no} - ${sessionDate}</b>\n`,
    `🔶 ${ama.reward} was sent to each eligible winner based on the contest terms.\n`,
    `🔶 The list of winners is here-below and good luck to everyone in the upcoming AMA session\n`,
    `🎁 <b>Eligible winners:</b>\n`,
    winnersList,
    `\n🎉 We look forward to your future participation in the Binance Weekly Sessions.`,
  ].join("\n");

  const publicGroupId = groupIds.public[ama.language];

  const broadcastToPublic = await ctx.telegram.sendPhoto(
    publicGroupId,
    congratsImg,
    {
      caption: message,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "Claim Reward",
              url: `${ama.form_link}`,
            },
          ],
        ],
      },
    }
  );

  if (broadcastToPublic.message_id) {
    return void ctx.reply(
      "Winners broadcasted successfully to the public group."
    );
  } else {
    return void ctx.reply("Failed to broadcast winners to the public group.");
  }
}
