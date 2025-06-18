import { Context, Markup } from "telegraf";
import {
  AMA_COMMANDS,
  AMA_DEFAULT_DATA,
  AMA_HASHTAG,
  CALLBACK_ACTIONS,
} from "../ama.constants";
import { formatTimeTo12Hour } from "./utils";

/**
 * Generates the HTML-formatted AMA message.
 */
function generateAMAMessage(session_no: number): string {
  return `<b>📣 Join us for an AMA from our Binance Weekly Sessions with #BinanceMENA</b> team and get a chance to share a portion of the total reward pool worth <b>${AMA_DEFAULT_DATA.total_pool}</b> 🎁

⬇️ <b>Reward pool</b> will be shared up to <b>${AMA_DEFAULT_DATA.winner_count}</b> winners for a prize of <b>${AMA_DEFAULT_DATA.reward}</b> each 🎁

📅 <b>${AMA_DEFAULT_DATA.date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} @ ${formatTimeTo12Hour(AMA_DEFAULT_DATA.time)}</b>

📍 <a href="https://t.me/BinanceMENAEnglish?videochat=1a351cbb96f51351b0">Join Voice Chat</a>

<b>⚡ To be eligible to win, you must:</b>
1️⃣ Complete this <a href="${AMA_DEFAULT_DATA.form_link}">form</a> to become qualified for the reward.
2️⃣ Participate in the voice call 🗣️
3️⃣ Ask a question during the call using the hashtag <b>#${AMA_HASHTAG}${session_no}</b>
4️⃣ Have a username
5️⃣ Not be a winner of the competition in the last 30 days.

⛔ Binance reserves the right to disqualify any participants showing signs of fraudulent behavior immediately.
<a href="https://www.binance.com/en/pp-terms">Terms & Conditions</a>

‼️ <b>Winner announcement</b> and prize distribution will occur within the next two weeks.

❤️ We are delighted to have you with us!`;
}

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

    const message = generateAMAMessage(sessionNo);

    // Construct image path with proper error handling
    const imageUrl =
      "https://ff695b5dd2960f41cb75835a324f0804.r2.cloudflarestorage.com/drp-cl/373f7ca1-1d4d-4e78-ba4c-ce82a6a6871d/67ce832b-0763-4b97-8918-37fc7be2578a/db00a674-7bad-4c57-8c19-9554f9a67ddd.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=fed7aac277aea51eca0c294ada409f61%2F20250618%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20250618T060217Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=168745b090115af8c2df507c4e318781c0ce4f3ad2cb7dea12dbc7eb50263329";

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
