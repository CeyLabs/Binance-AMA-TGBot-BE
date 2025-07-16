import { Logger } from "@nestjs/common";
import { OpenAIAnalysis } from "../types";

const logger = new Logger("MessageProcessorUtils");

/**
 * Format an analysis result into a Telegram message
 * @param analysis The OpenAI analysis result
 * @returns Formatted HTML message
 */
export function formatAnalysisMessage(analysis: OpenAIAnalysis): string {
  return (
    `<b>📊 AI Analysis</b>\n\n` +
    `<b>✨ Originality:</b> ${analysis.originality?.score}/10\n` +
    `<i>${analysis.originality?.comment}</i>\n\n` +
    `<b>🔍 Clarity:</b> ${analysis.clarity?.score}/10\n` +
    `<i>${analysis.clarity?.comment}</i>\n\n` +
    `<b>📢 Engagement:</b> ${analysis.engagement?.score}/10\n` +
    `<i>${analysis.engagement?.comment}</i>\n\n` +
    `<b>🏁 Total Score:</b> <b>${analysis.total_score}/30</b>`
  );
}

/**
 * Handle Telegram API errors with special handling for rate limiting
 * @param error The error object from Telegram API
 * @param context Context for the error (e.g. "forwarding message")
 * @param messageId The message ID being processed
 * @returns Object with retry flag and delay
 */
export function handleTelegramError(
  error: any,
  context: string,
  messageId: string,
): { shouldRetry: boolean; retryAfter: number } {
  const telegramError = error as {
    response?: {
      error_code: number;
      description?: string;
      parameters?: { retry_after?: number };
    };
    message?: string;
  };

  if (telegramError.response?.error_code === 429) {
    const retryAfter = telegramError.response?.parameters?.retry_after || 5;
    logger.warn(
      `Rate limited when ${context} for message ${messageId}. Retry after ${retryAfter}s`,
    );
    return { shouldRetry: true, retryAfter };
  } else {
    const errorMessage = telegramError.message || "Unknown error";
    logger.error(`Failed to ${context} for message ${messageId}: ${errorMessage}`);
    return { shouldRetry: false, retryAfter: 0 };
  }
}
