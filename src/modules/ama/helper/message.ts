import { AMA_HASHTAG } from "../ama.constants";

export function generateAMAMessage(
  amaNumber: string | number,
  amaName: string
): string {
  return `
📢 <b>Binance MENA Weekly AMA #${amaNumber}</b>

Join us for an exciting session to discuss <b>${amaName}</b>.

✅ <b>How to Participate:</b>
Ask your questions in this group using the below hashtag:

<pre>#${AMA_HASHTAG}${amaNumber}</pre>

🏆 The best questions will share the rewards! Get your questions ready!
  `.trim();
}
