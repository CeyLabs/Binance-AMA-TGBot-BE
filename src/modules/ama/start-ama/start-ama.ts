import { Context } from "telegraf";
import { AMA_COMMANDS, CALLBACK_ACTIONS } from "../ama.constants";

import { AMA, GroupInfo } from "../types";
import { getLanguageText, UUID_PATTERN, validateIdPattern } from "../helper/utils";
import { UUID } from "crypto";
import { DbLoggerService } from "src/logger/db-logger.service";

export async function handleStartAMA(
  ctx: Context,
  groupIds: GroupInfo,
  getAMAsBySessionNo: (sessionNo: number) => Promise<AMA[]>,
  updateAMA: (id: UUID, data: Partial<AMA>) => Promise<boolean>,
  logger?: DbLoggerService,
): Promise<void> {
  const text = ctx.text;
  if (!text) return void ctx.reply("Invalid command format.");

  const match = text.replace(new RegExp(`^/${AMA_COMMANDS.START}\\s+`), "").match(/^(\d+)/);
  const sessionNo = match ? parseInt(match[1], 10) : NaN;
  if (!sessionNo || sessionNo <= 0) {
    return void ctx.reply("Invalid session number. Please provide a valid number.");
  }

  const existingAMAs = await getAMAsBySessionNo(sessionNo);
  if (existingAMAs.length === 0) {
    return void ctx.reply(`No AMA session found for session #${sessionNo}.`);
  }

  const availableAMAs = existingAMAs.filter(
    (ama) => ama.status === "broadcasted",
  );

  if (availableAMAs.length === 0) {
    return void ctx.reply(
      "This AMA has not been broadcasted yet. Please broadcast first and then start.",
    );
  }

  if (availableAMAs.length === 1) {
    return startAMA(ctx, groupIds, availableAMAs[0], updateAMA, logger);
  } else if (availableAMAs.length > 1) {
    return void ctx.reply(`Select the community group to Start AMA`, {
      reply_markup: {
        inline_keyboard: [
          availableAMAs.map((ama) => ({
            text: getLanguageText(ama.language),
            callback_data: `${CALLBACK_ACTIONS.START_AMA}_${ama.id}`,
          })),
        ],
      },
    });
  }

  return void ctx.reply(`AMA session is already active or has ended.`);
}

export async function startAMAbyCallback(
  ctx: Context,
  groupIds: GroupInfo,
  getAMAById: (id: string) => Promise<AMA | null>,
  updateAMA: (id: UUID, data: Partial<AMA>) => Promise<boolean>,
  logger?: DbLoggerService,
): Promise<void> {
  const callbackData =
    ctx.callbackQuery && "data" in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
  if (!callbackData) return void ctx.answerCbQuery("Invalid callback data.");

  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.START_AMA}_${UUID_PATTERN}`, "i"),
  );
  if (!result) return;

  const ama = await getAMAById(result.id);
  if (!ama) return void ctx.answerCbQuery("AMA session not found.");
  if (ama.status !== "broadcasted") {
    return void ctx.answerCbQuery(
      "This AMA has not been broadcasted yet. Please broadcast first and then start.",
    );
  }

  // Delete the callback query message to clean up
  if (ctx.callbackQuery && ctx.callbackQuery.message) {
    await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
  }

  await startAMA(ctx, groupIds, ama, updateAMA, logger);
}

// Generic function to start an AMA session
async function startAMA(
  ctx: Context,
  groupIds: GroupInfo,
  ama: AMA,
  updateAMA: (id: UUID, data: Partial<AMA>) => Promise<boolean>,
  logger?: DbLoggerService,
): Promise<void> {
  if (ama.status !== "broadcasted") {
    await ctx.reply(
      "This AMA has not been broadcasted yet. Please broadcast first and then start.",
    );
    return;
  }
  const thread = await ctx.telegram.callApi("createForumTopic", {
    chat_id: groupIds.admin,
    name: `#${ama.session_no} ${ama.language.toUpperCase()} AMA Session`,
  });

  await updateAMA(ama.id, {
    thread_id: thread.message_thread_id,
    status: "active",
  });

  await ctx.reply(`#${ama.session_no} has started!`);
  logger?.log(`AMA #${ama.session_no} started in ${ama.language} group.`, ctx.from?.id.toString());
  await ctx.reply("Binance AMA Bot is listening to the messages in Binance MENA group.");

  // Notify the public group about the AMA start
  const publicGroupId = groupIds.public[ama.language];
  const message = `#${ama.session_no} ${getLanguageText(ama.language)} AMA Session has started! Post your questions now.`;
  await ctx.telegram.sendMessage(publicGroupId, message, {
    parse_mode: "HTML",
  });
}
