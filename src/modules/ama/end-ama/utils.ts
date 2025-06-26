import { AMA, ScoreData } from "../types";
import * as dayjs from "dayjs";

//prettier-ignore
export const placeEmojis = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

export const congratsImg =
  "https://a.dropoverapp.com/cloud/download/002b40b8-631c-4431-8f4b-5b8a977f4cd3/29e8d620-b2fe-4159-bb05-412c491f8b9f";


export function getSortedUniqueScores(scores: ScoreData[]): ScoreData[] {
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

  return Object.values(uniqueScores).sort((a, b) => b.score - a.score);
}

export function formatWinnersList(
  winners: ScoreData[],
  showMedals = true
): string {
  return winners
    .map((winner, index) => {
      const emoji = placeEmojis[index] || `${index + 1}.`;
      const medals = showMedals && index < 3 ? " 🎖️" : "";
      return `${emoji} <b>${winner.username}</b> - Score: ${winner.score}${medals}`;
    })
    .join("\n");
}

export function buildWinnersAnnouncement(
  ama: AMA,
  winners: ScoreData[],
  showMedals: boolean = true
): string {
  const sessionDate = ama.created_at
    ? dayjs(ama.created_at).format("MMMM D")
    : "Unknown Date";

  const winnersList = formatWinnersList(winners, showMedals);

  return [
    `🏆 <b>Congratulations to the winners in our Binance Weekly Session #${ama.session_no} - ${sessionDate}</b>\n`,
    `🔶 ${ama.reward} was sent to each eligible winner based on the contest terms.\n`,
    `🔶 The list of winners is here-below and good luck to everyone in the upcoming AMA session\n`,
    `🎁 <b>Eligible winners:</b>\n`,
    winnersList,
    `\n🎉 We look forward to your future participation in the Binance Weekly Sessions.`,
  ].join("\n");
}
