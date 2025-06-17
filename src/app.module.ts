/**
 * @fileoverview Root module of the Template Telegram Bot application
 * @module app.module
 */

import { Module } from "@nestjs/common";
import { TelegrafModule } from "nestjs-telegraf";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { config } from "dotenv";
import { AppService } from "./app.service";
import { AppController } from "./app.controller";
import { WelcomeModule } from "./modules/welcome/welcome.module";
import { PrivateChatMiddleware } from "./middleware/chat-type.middleware";
import { HelpModule } from './modules/help/help.module';

// Load environment variables
config();

/**
 * Root module of the application that configures and bootstraps all required modules
 * @class AppModule
 * @description Configures the main application module with all necessary dependencies,
 * including the Telegram bot, database connection, and various feature modules.
 */
@Module({
  imports: [
    ConfigModule.forRoot(),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const token = configService.get<string>("TELEGRAM_BOT_TOKEN");
        if (!token) {
          throw new Error(
            "TELEGRAM_BOT_TOKEN is not defined in the environment variables",
          );
        }
        return {
          token,
          launchOptions:
            process.env.ENABLE_WEBHOOK === "true"
              ? {
                  webhook: {
                    domain: configService.get<string>("WEBHOOK_DOMAIN") || "",
                    path: "/webhook",
                  },
                }
              : {},
          middlewares: [new PrivateChatMiddleware().use()],
        };
      },
      inject: [ConfigService],
    }),
    WelcomeModule,
    HelpModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
