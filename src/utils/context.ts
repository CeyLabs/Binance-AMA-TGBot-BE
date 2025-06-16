/**
 * @fileoverview Utility functions for handling Telegraf context
 * @module context
 */

import { Context } from "telegraf";

/**
 * Extracts the Telegram user ID from a Telegraf context object
 * @param {Context} ctx - The Telegraf context object
 * @returns {string | null} The user's Telegram ID as a string, or null if not found
 * @description Attempts to extract the user ID from various context properties:
 * - message.from.id
 * - from.id
 * - chat.id
 * - callbackQuery.from.id
 */
export const getContextTelegramUserId = (ctx: Context): string | null => {
  if (ctx.message && ctx.message.from) {
    return ctx.message.from.id.toString();
  }

  if (ctx.from && ctx.from.id) {
    return ctx.from.id.toString();
  }

  if (ctx.chat && ctx.chat.id) {
    return ctx.chat.id.toString();
  }

  if (
    ctx.callbackQuery &&
    ctx.callbackQuery.from &&
    ctx.callbackQuery.from.id
  ) {
    return ctx.callbackQuery.from.id.toString();
  }

  return null;
};
