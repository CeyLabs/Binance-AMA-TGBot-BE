/**
 * @fileoverview Main application entry point for the Template Telegram Bot
 * @module main
 */

import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { getBotToken } from "nestjs-telegraf";
import { Telegraf } from "telegraf";
import { json } from "express";
import { Request, Response, NextFunction } from "express";
import { ConsoleLogger } from "@nestjs/common";
import { KnexService } from "./modules/knex/knex.service";
import { DbLoggerService } from "./logger/db-logger.service";

// Add request logger middleware
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  console.log(
    `[${new Date().toISOString()}]` +
      ` ${req.method.padEnd(6)} ${req.url}` +
      (req.body ? `\n  Body: ${JSON.stringify(req.body, null, 2)}` : ""),
  );
  next();
};

/**
 * Bootstraps the NestJS application and configures the Telegram bot
 * @async
 * @function bootstrap
 * @returns {Promise<void>}
 * @throws {Error} If there's an error during application bootstrap
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Initialize database logger
  const knexService = app.get(KnexService);
  const dbLogger = new DbLoggerService(knexService);
  app.useLogger(dbLogger);

  // Get the bot instance
  const bot = app.get<Telegraf>(getBotToken());

  app.use(json());
  if (process.env.WEBHOOK_LOGS === "true") {
    // Use the request logger middleware only if webhook is enabled
    app.use(requestLogger);
  }

  // Connect the webhook middleware
  app.use(bot.webhookCallback("/webhook"));

  // Start the NestJS application
  const PORT = process.env.PORT || 3000;
  await app.listen(PORT, () => {
    dbLogger.log(`Application is running on port ${PORT}`);
  });
}

bootstrap().catch((error) => {
  const logger = new ConsoleLogger();
  logger.error(
    "Error during application bootstrap:",
    (error as Error).stack,
  );
});
