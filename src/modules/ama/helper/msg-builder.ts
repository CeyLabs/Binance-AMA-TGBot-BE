import { formatTimeTo12Hour } from "../helper/utils";
import { AMA_HASHTAG } from "../ama.constants";

interface AMAData {
  session_no: number;
  language: "en" | "ar";
  date: Date | string;
  time: string;
  total_pool: string;
  reward: string;
  winner_count: number;
  form_link: string;
}

/**
 * Builds an HTML-formatted AMA message
 */
export function buildAMAMessage(data: AMAData): string {
  const formattedDate =
    typeof data.date === "string"
      ? new Date(data.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : data.date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

  const formattedTime = formatTimeTo12Hour(data.time);

  return `<b>📣 Join us for an AMA from our Binance Weekly Sessions with #BinanceMENA</b> team and get a chance to share a portion of the total reward pool worth <b>${data.total_pool}</b> 🎁

⬇️ <b>Reward pool</b> will be shared up to <b>${data.winner_count}</b> winners for a prize of <b>${data.reward}</b> each 🎁

📅 <b>${formattedDate} @ ${formattedTime}</b>

📍 <a href="https://t.me/BinanceMENAEnglish?videochat=1a351cbb96f51351b0">Join Voice Chat</a>

<b>⚡ To be eligible to win, you must:</b>
1️⃣ Complete this <a href="${data.form_link}">form</a> to become qualified for the reward.
2️⃣ Participate in the voice call 🗣️
3️⃣ Ask a question during the call using the hashtag <b>#${AMA_HASHTAG}${data.session_no}</b>
4️⃣ Have a username
5️⃣ Not be a winner of the competition in the last 30 days.

⛔ Binance reserves the right to disqualify any participants showing signs of fraudulent behavior immediately.
<a href="https://www.binance.com/en/pp-terms">Terms & Conditions</a>

‼️ <b>Winner announcement</b> and prize distribution will occur within the next two weeks.

❤️ We are delighted to have you with us!`;
}

export const imageUrl =
  "https://ff695b5dd2960f41cb75835a324f0804.r2.cloudflarestorage.com/drp-cl/373f7ca1-1d4d-4e78-ba4c-ce82a6a6871d/67ce832b-0763-4b97-8918-37fc7be2578a/db00a674-7bad-4c57-8c19-9554f9a67ddd.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=fed7aac277aea51eca0c294ada409f61%2F20250618%2Fauto%2Fs3%2Faws4_request&X-Amz-Date=20250618T060217Z&X-Amz-Expires=3600&X-Amz-SignedHeaders=host&X-Amz-Signature=168745b090115af8c2df507c4e318781c0ce4f3ad2cb7dea12dbc7eb50263329";
