import { Context, Markup } from "telegraf";
import {
  AMA_COMMANDS,
  AMA_DEFAULT_DATA,
  CALLBACK_ACTIONS,
} from "../ama.constants";
import { buildAMAMessage, imageUrl } from "../helper/msg-builder";

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
      // prettier-ignore
      reply_markup: Markup.inlineKeyboard([
        [
          Markup.button.callback("Edit Date", `${CALLBACK_ACTIONS.EDIT_DATE}_${sessionNo}`),
          Markup.button.callback("Edit Time", `${CALLBACK_ACTIONS.EDIT_TIME}_${sessionNo}`),
        ],
        [
          Markup.button.callback("Edit Session Number", `${CALLBACK_ACTIONS.EDIT_SESSION}_${sessionNo}`),
          Markup.button.callback("Edit Reward Prize", `${CALLBACK_ACTIONS.EDIT_REWARD}_${sessionNo}`),
        ],
        [
          Markup.button.callback("Edit Winner Count", `${CALLBACK_ACTIONS.EDIT_WINNERS}_${sessionNo}`),
          Markup.button.callback("Edit Form Link", `${CALLBACK_ACTIONS.EDIT_FORM}_${sessionNo}`),
        ],
        [
          Markup.button.callback("Add Topic", `${CALLBACK_ACTIONS.ADD_TOPIC}_${sessionNo}`),
          Markup.button.callback("Add Special Guest", `${CALLBACK_ACTIONS.ADD_GUEST}_${sessionNo}`),
        ],
        [
          Markup.button.callback("Cancel", `${CALLBACK_ACTIONS.CANCEL}_${sessionNo}`),
          Markup.button.callback("✅ Confirm", `${CALLBACK_ACTIONS.CONFIRM}_${sessionNo}`),
        ],
      ]).reply_markup,
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
