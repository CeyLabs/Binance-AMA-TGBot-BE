import {
  AMA_COMMANDS,
  AMA_DEFAULT_DATA,
  CALLBACK_ACTIONS,
  SUPPORTED_LANGUAGES,
} from "../ama.constants";
import { buildAMAMessage, imageUrl } from "./helper/msg-builder";
import { BotContext, SupportedLanguage } from "../types";
import { NewAMAKeyboard } from "./helper/keyboard.helper";
import { UUID } from "crypto";
import { UUID_PATTERN, validateIdPattern } from "../helper/utils";
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Handles the /newama command and sends an image with inline buttons.
 */
export async function handleNewAMA(
  ctx: BotContext,
  createAMA: (sessionNo: number, language: SupportedLanguage, topic?: string) => Promise<UUID>,
  isAMAExists: (sessionNo: number, language: SupportedLanguage) => Promise<boolean>,
): Promise<void> {
  try {
    const text = ctx.text;

    if (!text) {
      await ctx.reply("Invalid command format.");
      return;
    }

    // Parse the command arguments
    const argsText = text.replace(new RegExp(`^/${AMA_COMMANDS.NEW}\\s+`), "");
    const match = argsText.match(/^(\w+)\s+(\d+)/);

    if (!match) {
      await ctx.reply("Invalid command format. Use: /newama <language> <number>");
      return;
    }

    const [, language, sessionNumber] = match;

    //validate language by check if its "en" or "ar"
    if (!SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)) {
      await ctx.reply("Invalid language. Please use 'en' for English or 'ar' for Arabic.");
      return;
    }

    // Validate session number
    const sessionNo = parseInt(sessionNumber, 10);
    if (isNaN(sessionNo) || sessionNo <= 0) {
      await ctx.reply("Invalid session number. Please provide a valid number.");
      return;
    }

    // Check if the session number already exists
    const sessionExists = await isAMAExists(sessionNo, language as SupportedLanguage);
    if (sessionExists) {
      await ctx.reply(
        `AMA session number ${sessionNo} already exists. Please choose a different number.`,
      );
      return;
    }

    const annunceMsg = await ctx.reply("Creating AMA...");

    // Create the AMA first
    const AMA_ID = await createAMA(
      sessionNo,
      language as SupportedLanguage,
      argsText.replace(match[0], "").trim(),
    );

    if (!AMA_ID) {
      await ctx.reply("Failed to create AMA. Please try again.");
      return;
    }

    const ksaDateTime = `${AMA_DEFAULT_DATA.date}T${AMA_DEFAULT_DATA.time}`;
    const datetimeUTC = dayjs.tz(ksaDateTime, "Asia/Riyadh").utc().toDate();

    const message = buildAMAMessage({
      session_no: sessionNo,
      language: language as SupportedLanguage,
      datetime: datetimeUTC,
      total_pool: AMA_DEFAULT_DATA.total_pool,
      reward: AMA_DEFAULT_DATA.reward,
      winner_count: AMA_DEFAULT_DATA.winner_count,
      form_link: AMA_DEFAULT_DATA.form_link,
    });

    const amaMsg = await ctx.replyWithPhoto(imageUrl, {
      caption: message,
      parse_mode: "HTML",
      reply_markup: NewAMAKeyboard(AMA_ID),
    });

    // If the message was sent successfully, delete the announce message
    if (amaMsg) {
      await ctx.deleteMessage(annunceMsg.message_id);
    }

    // Push the message IDs to delete later
    ctx.session.messagesToDelete ??= [];
    ctx.session.messagesToDelete.push(annunceMsg.message_id, amaMsg.message_id);
  } catch (error) {
    console.error("Error in handleNewAMA:", error);
    await ctx.reply("An error occurred while processing your request. Please try again.");
  }
}

export async function handleNewAMACancel(
  ctx: BotContext,
  deleteAMA: (id: UUID) => Promise<boolean>,
): Promise<void> {
  const result = await validateIdPattern(
    ctx,
    new RegExp(`^${CALLBACK_ACTIONS.CANCEL}_${UUID_PATTERN}`, "i"),
  );
  if (!result) return;
  const { id: AMA_ID } = result;

  const deleted = await deleteAMA(AMA_ID);
  if (deleted && ctx.callbackQuery && "message" in ctx.callbackQuery) {
    await ctx.editMessageReplyMarkup({
      inline_keyboard: [],
    });
    await ctx.reply("AMA session has been cancelled successfully.");
  } else {
    await ctx.answerCbQuery("Failed to cancel the AMA session. Please try again.");
  }
}
