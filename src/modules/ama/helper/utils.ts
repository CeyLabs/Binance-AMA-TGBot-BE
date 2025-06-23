import { Context } from "telegraf";

export async function validateCallbackPattern(
  ctx: Context,
  actionPrefix: string,
  pattern: RegExp
): Promise<{ sessionNo: number } | null> {
  const callbackQuery = ctx.callbackQuery as any;

  if (!callbackQuery?.data) {
    await ctx.answerCbQuery("Missing callback data.", { show_alert: true });
    return null;
  }

  const match = callbackQuery.data.match(pattern);

  if (!match || isNaN(Number(match[1]))) {
    await ctx.answerCbQuery("Invalid callback format.", { show_alert: true });
    return null;
  }

  return {
    sessionNo: parseInt(match[1], 10),
  };
}


export function formatTimeTo12Hour(time24: string): string {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const adjustedHour = hours % 12 || 12;
  return `${adjustedHour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${period} KSA`;
}
