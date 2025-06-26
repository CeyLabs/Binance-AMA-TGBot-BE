import { UUID } from "crypto";
import { Context } from "telegraf";
import { AMA_COMMANDS, AMA_HASHTAG, CALLBACK_ACTIONS } from "../ama.constants";
import { AMA, BotContext, GroupInfo, ScoreData } from "../types";
import {
  getLanguageText,
  UUID_FRAGMENT,
  UUID_PATTERN,
  validateIdPattern,
} from "../helper/utils";
import {
  buildWinnersAnnouncement,
  congratsImg,
  getSortedUniqueScores,
  placeEmojis,
} from "./utils";

export async function handleEndAMA(
  ctx: Context,
  getAMAsBySessionNo: (sessionNo: number) => Promise<AMA[]>,
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
    return selectWinners(ctx, availableAMAs[0], getScoresForAMA);
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
  getScoresForAMA: (amaId: UUID) => Promise<ScoreData[]>
): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.END_AMA}_${UUID_PATTERN}`, "i")
  );
  if (!result) return;

  const ama = await getAMAById(result.id);
  if (!ama) return void ctx.answerCbQuery("AMA session not found.");
  if (ama.status !== "active")
    return void ctx.reply("AMA session is not active.");

  await selectWinners(ctx, ama, getScoresForAMA);
}

// Generic function to start an AMA session
async function selectWinners(
  ctx: Context,
  ama: AMA,
  getScoresForAMA: (amaId: UUID) => Promise<ScoreData[]>
): Promise<void> {
  await ctx.reply(`#${AMA_HASHTAG}${ama.session_no} has ended!`);
  await ctx.reply("TODO: CSV need to be generated and sent to the group.");

  // Top 10 scores
  const scores = await getScoresForAMA(ama.id);

  const sortedScores = getSortedUniqueScores(scores);

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

  // Send a mesage with top users with callback btns
  if (topScores.length === 0) {
    return void ctx.reply(`No scores found for AMA #${ama.session_no}.`);
  }

  await ctx.reply(
    `🏆 <b>Top 10 Unique Users Scored Best for AMA #${ama.session_no}:</b>`,
    {
      parse_mode: "HTML",
      // prettier-ignore
      reply_markup: {
        inline_keyboard: [
          ...sortedScores.slice(0, 10).map((user, index) => {
            const place = `${(index + 1).toString().padStart(2, "0")}.`;
            const medals = index === 1 ? " 🥈🌟" : index === 2 ? " 🥉🌟" : "";
            const scoreDisplay = ` - Score: ${user.score}${medals}`;
            return [
              {text: `${place} ${user.username}${scoreDisplay}`, callback_data: `noop`},
              {text: "❌", callback_data: `${CALLBACK_ACTIONS.DISCARD_WINNER}_${user.user_id}_${ama.id}`},
            ];
          }),
          [
            {text: `✅ Confirm top ${ama.winner_count} winners`, callback_data: `confirm_${ama.id}_${ama.winner_count}`},
          ],
        ],
      },
    }
  );
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
  const sortedScores = getSortedUniqueScores(scores);

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
      // prettier-ignore
      inline_keyboard: [
        [
          {text: "Cancel", callback_data: `${CALLBACK_ACTIONS.CANCEL_WINNERS}s_${ama.id}`},
          {text: "Confirm", callback_data: `${CALLBACK_ACTIONS.CONFIRM_WINNERS}_${ama.id}`},
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

  const sortedScores = getSortedUniqueScores(scores);

  const topWinners = sortedScores.slice(0, 5); // Display top 5 only

  const message = buildWinnersAnnouncement(ama, topWinners);

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
  getScoresForAMA: (amaId: UUID) => Promise<ScoreData[]>,
  groupIds: GroupInfo
): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.BROADCAST_WINNERS}_${UUID_PATTERN}`, "i")
  );
  if (!result) return;

  const id = result.id;
  const ama = await getAMAById(id);

  if (!ama) {
    return void ctx.reply("AMA session not found.");
  }

  const scores = await getScoresForAMA(ama.id);

  if (scores.length === 0) {
    return void ctx.reply("No winners found for this AMA session.");
  }

  const sortedScores = getSortedUniqueScores(scores);

  const topWinners = sortedScores.slice(0, 5); // Display top 5 only

  const message = buildWinnersAnnouncement(ama, topWinners);

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

export async function handleDiscardUser(
  ctx: BotContext,
  getAMAById: (id: UUID) => Promise<AMA | null>,
  getScoresForAMA: (id: UUID) => Promise<ScoreData[]>
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
    ctx.session.discardedUsersByAMA[amaId].includes(userId);

  if (alreadyDiscarded) {
    await ctx.answerCbQuery("User already discarded 🚫");
    return;
  }

  // Add to discard list
  ctx.session.discardedUsersByAMA[amaId].push(userId);
  const ama = await getAMAById(id);
  if (!ama) {
    return void ctx.answerCbQuery("AMA session not found.");
  }
  const scores = await getScoresForAMA(id);

  const discardedUserIds = new Set(
    (ctx.session.discardedUsersByAMA?.[id] ?? []).map(Number)
  );

  const sortedScores = getSortedUniqueScores(scores).filter(
    (score) => !discardedUserIds.has(Number(score.user_id))
  );

  // prettier-ignore
  const keyboard = [
    ...sortedScores.slice(0, 10).map((user, index) => {
      const place = `${(index + 1).toString().padStart(2, "0")}.`;
      const medals = index === 1 ? " 🥈🌟" : index === 2 ? " 🥉🌟" : "";
      const scoreDisplay = ` - Score: ${user.score}${medals}`;

      return [
        {text: `${place} ${user.username}${scoreDisplay}`,callback_data: `noop`},
        {text: "❌", callback_data: `${CALLBACK_ACTIONS.DISCARD_WINNER}_${user.user_id}_${ama.id}`},
      ];
    }),
    [
      {text: `✅ Confirm op ${ama.winner_count} winners`, callback_data: `confirm_${ama.id}_${ama.winner_count}`},
    ],
  ];

  await ctx.editMessageReplyMarkup({
    inline_keyboard: keyboard,
  });

  await ctx.answerCbQuery("User discarded ✅");
}
