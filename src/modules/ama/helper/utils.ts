import { UUID } from "crypto";
import { Context } from "telegraf";
import { SupportedLanguage } from "../types";

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const UUID_PATTERN = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$";

export const UUID_FRAGMENT = "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})";

// This function validates the callback data against a given pattern
export async function validateIdPattern(ctx: Context, pattern: RegExp): Promise<{ id: UUID } | null> {
  const callbackQuery = ctx.callbackQuery;

  if (!callbackQuery) {
    await ctx.answerCbQuery("Missing callback data.", { show_alert: true });
    return null;
  }

  const data = "data" in callbackQuery ? callbackQuery.data : undefined;
  if (!data) {
    await ctx.answerCbQuery("Missing callback data.", { show_alert: true });
    return null;
  }

  const match = data.match(pattern);

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

export function getLanguageText(language: SupportedLanguage): string {
  return language === "ar" ? "Arabic" : "English";
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

