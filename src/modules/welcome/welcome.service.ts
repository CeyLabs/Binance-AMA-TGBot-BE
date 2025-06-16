/**
 * @fileoverview Service for handling welcome-related functionality in the Telegram bot
 * @module welcome.service
 */

import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { Start, Update } from "nestjs-telegraf";

/**
 * Service class that handles all welcome functionality
 * @class WelcomeService
 * @description Manages user onboarding, registration, and welcome messages
 */
@Update()
@Injectable()
export class WelcomeService {
  /**
   * Creates an instance of WelcomeService
   */
  constructor() {}

  /**
   * Handles the /start command from users
   * @param {Context} ctx - The Telegraf context object
   * @returns {Promise<void>}
   * @description Processes the start command
   */
  @Start()
  async handleStartCommand(ctx: Context): Promise<void> {
    await ctx.reply("Hello there! Welcome to the Template Bot.");
  }
}
