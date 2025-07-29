import {
  AMA_COMMANDS,
  AMA_DEFAULT_DATA,
  CALLBACK_ACTIONS,
  SUPPORTED_LANGUAGES,
} from "../ama.constants";
import { buildAMAMessage, initImageUrl } from "./helper/msg-builder";
import { AMA, BotContext, SupportedLanguage } from "../types";
import { NewAMAKeyboard } from "./helper/keyboard.helper";
import { UUID } from "crypto";
import { UUID_PATTERN, validateIdPattern } from "../helper/utils";
import * as dayjs from "dayjs";
import * as utc from "dayjs/plugin/utc";
import * as timezone from "dayjs/plugin/timezone";
import { DbLoggerService } from "../../../logger/db-logger.service";
import { TIMEZONES } from "../helper/date-utils";

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Handles the /newama command and sends an image with inline buttons.
 */
export async function handleNewAMA(
  ctx: BotContext,
  createAMA: (
    sessionNo: number,
    language: SupportedLanguage,
    topic?: string,
  ) => Promise<UUID>,
  isAMAExists: (
    sessionNo: number,
    language: SupportedLanguage,
  ) => Promise<boolean>,
  getAMABySessionNoAndLang: (
    sessionNo: number,
    language: SupportedLanguage,
  ) => Promise<AMA | null>,
  canUserCreateAMA: (userId: string) => Promise<boolean>,
  logger?: DbLoggerService,
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
    const existingAMA = await getAMABySessionNoAndLang(
      sessionNo,
      language as SupportedLanguage,
    );

    if (existingAMA) {
      if (existingAMA.status === "active" || existingAMA.status === "ended") {
        await ctx.reply(
          `AMA session number ${sessionNo} already exists and is ${existingAMA.status}.`,
        );
        return;
      }

      const message = buildAMAMessage({
        session_no: existingAMA.session_no,
        language: existingAMA.language,
        datetime: existingAMA.datetime,
        total_pool: existingAMA.total_pool,
        reward: existingAMA.reward,
        winner_count: existingAMA.winner_count,
        form_link: existingAMA.form_link,
        banner_file_id: existingAMA.banner_file_id,
      });

      const amaMsg = await ctx.replyWithPhoto(
        existingAMA.banner_file_id || initImageUrl[language],
        {
          caption: message,
          parse_mode: "HTML",
          reply_markup: NewAMAKeyboard(existingAMA.id),
        },
      );

      logger?.log(
        `Loaded existing AMA session ${existingAMA.id}`,
        ctx.from?.id.toString(),
      );

      ctx.session.messagesToDelete ??= [];
      ctx.session.messagesToDelete.push(amaMsg.message_id);
      return;
    }

    // Check if user has permission to create new AMAs (for editor users who can only edit)
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await canUserCreateAMA(fromId))) {
      await ctx.reply("You can only edit existing AMAs. This session number does not exists.");
      return;
    }

    const annunceMsg = await ctx.reply("Announcement Created!");
    logger?.log(`Creating AMA session ${sessionNo} (${language})`, ctx.from?.id.toString());

    // Create the AMA and get the ID
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
    const datetimeUTC = dayjs.tz(ksaDateTime, TIMEZONES.KSA).utc().toDate();

    const message = buildAMAMessage({
      session_no: sessionNo,
      language: language as SupportedLanguage,
      datetime: datetimeUTC,
      total_pool: AMA_DEFAULT_DATA.total_pool,
      reward: AMA_DEFAULT_DATA.reward,
      winner_count: AMA_DEFAULT_DATA.winner_count,
      form_link: AMA_DEFAULT_DATA.form_link,
    });

    logger?.log(`AMA created with id ${AMA_ID}`, ctx.from?.id.toString());

    const amaMsg = await ctx.replyWithPhoto(initImageUrl[language], {
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
    logger?.error("Error in handleNewAMA", (error as Error).stack, ctx.from?.id.toString());
    await ctx.reply("An error occurred while processing your request. Please try again.");
  }
}

export async function handleNewAMACancel(
  ctx: BotContext,
  deleteAMA: (id: UUID) => Promise<boolean>,
  logger?: DbLoggerService,
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
    logger?.log(`AMA ${AMA_ID} cancelled`, ctx.from?.id.toString());
  } else {
    await ctx.answerCbQuery("Failed to cancel the AMA session. Please try again.");
  }
}
