import { Context, Markup } from "telegraf";
import {
  AMA_COMMANDS,
  AMA_DEFAULT_DATA,
  CALLBACK_ACTIONS,
} from "../ama.constants";
import { buildAMAMessage, imageUrl } from "../helper/msg-builder";
import { NewAMAKeyboard } from "../helper/keyboard.helper";

/**
 * Handles the /newama command and sends an image with inline buttons.
 */
export async function handleNewAMA(
  ctx: Context,
  createAMA: (sessionNo: number, topic?: string) => Promise<void>,
  isAMASessionExists: (sessionNo: number) => Promise<boolean>
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
      await ctx.reply(
        "Invalid command format. Use: /newama <language> <number>"
      );
      return;
    }

    const [, language, sessionNumber] = match;

    //validate language by check if its "en" or "ar"
    if (!["en", "ar"].includes(language)) {
      await ctx.reply(
        "Invalid language. Please use 'en' for English or 'ar' for Arabic."
      );
      return;
    }

    // Validate session number
    const sessionNo = parseInt(sessionNumber, 10);
    if (isNaN(sessionNo) || sessionNo <= 0) {
      await ctx.reply("Invalid session number. Please provide a valid number.");
      return;
    }

    // Check if the session number already exists
    const sessionExists = await isAMASessionExists(sessionNo);
    if (sessionExists) {
      await ctx.reply(
        `AMA session number ${sessionNo} already exists. Please choose a different number.`
      );
      return;
    }

    const message = buildAMAMessage({
      session_no: sessionNo,
      date: AMA_DEFAULT_DATA.date,
      time: AMA_DEFAULT_DATA.time,
      total_pool: AMA_DEFAULT_DATA.total_pool,
      reward: AMA_DEFAULT_DATA.reward,
      winner_count: AMA_DEFAULT_DATA.winner_count,
      form_link: AMA_DEFAULT_DATA.form_link,
    });

    await ctx.reply("Announcement Created!");
    // Send photo with caption and inline buttons
    await ctx.replyWithPhoto(imageUrl, {
      caption: message,
      parse_mode: "HTML",
      reply_markup: NewAMAKeyboard(sessionNo),
    });

    // Add the AMA to the database
    await createAMA(sessionNo, argsText.replace(match[0], "").trim());
    console.log(
      `New AMA created: Session No. ${sessionNo}, Language: ${language}`
    );
  } catch (error) {
    console.error("Error in handleNewAMA:", error);
    await ctx.reply(
      "An error occurred while processing your request. Please try again."
    );
  }
}
