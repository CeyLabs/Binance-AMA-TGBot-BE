/**
 * @fileoverview Main application entry point for the PizzaDao MoltoBene Telegram Bot
 * @module main
 */

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { getBotToken } from "nestjs-telegraf";
import { Telegraf } from "telegraf";
import { json } from "express";

/**
 * Bootstraps the NestJS application and configures the Telegram bot
 * @async
 * @function bootstrap
 * @returns {Promise<void>}
 * @throws {Error} If there's an error during application bootstrap
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get the bot instance
  const bot = app.get<Telegraf>(getBotToken());

  app.use(json());

  // Connect the webhook middleware
  if (process.env.ENABLE_WEBHOOK === "true") {
    app.use(bot.webhookCallback("/webhook"));
  }

  // Start the NestJS application
  const PORT = process.env.PORT || 3000;
  await app.listen(PORT, () => {
    console.log(`Application is running on port ${PORT}`);
  });
}

bootstrap().catch((error) => {
  console.error("Error during application bootstrap:", error);
});
