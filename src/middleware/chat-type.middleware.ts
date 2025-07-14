/**
 * @fileoverview Middleware for handling chat type restrictions
 * @module chat-type.middleware
 */

import { Context, MiddlewareFn } from "telegraf";
import { Injectable } from "@nestjs/common";

/**
 * Interface for new chat members message
 * @interface INewChatMembersMessage
 * @description Defines the structure of a message containing new chat members
 */
interface INewChatMembersMessage {
  /** Array of new chat members */
  new_chat_members: Array<{
    /** Unique identifier for the user */
    id: number;
    /** Whether the user is a bot */
    is_bot: boolean;
    /** First name of the user */
    first_name: string;
  }>;
}

/**
 * Middleware for handling private chat restrictions
 * @class PrivateChatMiddleware
 * @description Restricts bot commands and text messages to private chats only,
 * while allowing specific exceptions like inline queries and new member notifications
 */
@Injectable()
export class PrivateChatMiddleware {
  /**
   * Creates a middleware function that enforces chat type restrictions
   * @returns {MiddlewareFn<Context>} Middleware function that handles chat type restrictions
   */
  use(): MiddlewareFn<Context> {
    return async (ctx, next) => {
      const adminGroupId = process.env.ADMIN_GROUP_ID;

      // Allow all non-message updates (inline queries, callback queries, etc.)
      if (!ctx.chat && (ctx.inlineQuery || ctx.callbackQuery)) {
        return next();
      }

      // Allow "new_chat_members" in any chat
      if (
        "message" in ctx &&
        ctx.message &&
        "new_chat_members" in ctx.message &&
        Array.isArray((ctx.message as INewChatMembersMessage).new_chat_members)
      ) {
        return next();
      }

      // Send a message to /start command in groups
      if (
        ctx.chat?.type !== "private" &&
        ctx.message &&
        typeof ctx.message === "object" &&
        "text" in ctx.message &&
        typeof ctx.message.text === "string" &&
        ctx.message.text.startsWith("/start")
      ) {
        return next();
      }

      // Allow forwarded messages
      if (
        "message" in ctx &&
        ctx.message &&
        ("forward_from" in ctx.message ||
          "forward_from_chat" in ctx.message ||
          "forward_sender_name" in ctx.message)
      ) {
        return next();
      }

      // Allow private chats, groups, and supergroups
      if (
        ctx.chat?.type === "private" ||
        ctx.chat?.type === "group" ||
        ctx.chat?.type === "supergroup"
      ) {
        return next();
      }

      // Allow the specific admin group (match by ID as string)
      if (ctx.chat?.id?.toString() === adminGroupId) {
        return next();
      }

      // Block everything else (like group text/commands)

      return;
    };
  }
}
