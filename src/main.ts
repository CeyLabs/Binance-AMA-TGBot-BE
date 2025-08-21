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
import * as express from "express";
import * as path from "path";
import {
  createHelmetMiddleware,
  createRateLimitMiddleware,
  createCompressionMiddleware,
  createSecurityLoggingMiddleware,
  createIPFilterMiddleware,
  createWebhookIPFilterMiddleware,
  createTelegramSecretValidationMiddleware,
  createCORSMiddleware,
} from "./middleware/security.middleware";

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

  // Configure trust proxy for ALB/CloudFlare
  if (process.env.TRUST_PROXY === 'true') {
    const expressInstance = app.getHttpAdapter().getInstance() as express.Application;
    expressInstance.set('trust proxy', 1);
  }

  // Initialize database logger
  const knexService = app.get(KnexService);
  const dbLogger = new DbLoggerService(knexService);
  app.useLogger(dbLogger);

  // Get the bot instance
  const bot = app.get<Telegraf>(getBotToken());

  // Security middleware - order matters!
  app.use(createSecurityLoggingMiddleware());
  app.use(createCORSMiddleware());
  app.use(createIPFilterMiddleware());
  app.use(createWebhookIPFilterMiddleware());
  app.use(createTelegramSecretValidationMiddleware());
  app.use(createHelmetMiddleware());
  app.use(createCompressionMiddleware());
  app.use(createRateLimitMiddleware());
  app.use(json());
  if (process.env.WEBHOOK_LOGS === "true") {
    // Use the request logger middleware only if webhook is enabled
    app.use(requestLogger);
  }

  // Serve static files from the public directory
  app.use('/public', express.static(path.join(__dirname, '..', '..', 'public')));

  // Health check endpoint for ALB
  app.use('/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Connect the webhook middleware
  app.use(bot.webhookCallback("/webhook"));

  // Start the NestJS application
  const PORT = process.env.PORT || 3000;
  await app.listen(PORT, () => {
    dbLogger.log(`Application is running on port ${PORT}`);
    dbLogger.log(`Security middleware enabled: Helmet, Rate Limiting, Compression, IP Filtering`);
    dbLogger.log(`Webhook security: IP filtering=${process.env.WEBHOOK_IP_FILTERING || 'true'} (Telegram IP ranges: 149.154.160.0/20, 91.108.4.0/22)`);
    dbLogger.log(`GDPR compliance: ${process.env.GDPR_COMPLIANT_LOGGING === 'true' ? 'Enabled' : 'Disabled'}`);
    if (process.env.TRUST_PROXY === 'true') {
      dbLogger.log(`Trust proxy enabled for ALB/CloudFlare`);
    }
  });
}

bootstrap().catch((error) => {
  const logger = new ConsoleLogger();
  logger.error(
    "Error during application bootstrap:",
    (error as Error).stack,
  );
});
