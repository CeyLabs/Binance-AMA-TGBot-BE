import { UUID } from "crypto";
import { Context } from "telegraf";

export const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const UUID_PATTERN =
  "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$";

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

export async function validateIdPattern(
  ctx: Context,
  pattern: RegExp
): Promise<{ id: UUID } | null> {
  const callbackQuery = ctx.callbackQuery as any;

  console.log("Callback Query Data:", callbackQuery?.data);

  if (!callbackQuery?.data) {
    await ctx.answerCbQuery("Missing callback data.", { show_alert: true });
    return null;
  }

  const match = callbackQuery.data.match(pattern);

  if (!match || !match[1] || !UUID_REGEX.test(match[1])) {
    await ctx.answerCbQuery("Invalid callback format.", { show_alert: true });
    return null;
  }

  return {
    id: match[1] as UUID,
  };
}

export function formatTimeTo12Hour(time24: string): string {
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const adjustedHour = hours % 12 || 12;
  return `${adjustedHour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} ${period} KSA`;
}
