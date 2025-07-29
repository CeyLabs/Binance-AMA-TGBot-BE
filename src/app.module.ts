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
import { HelpModule } from "./modules/help/help.module";
import { KnexModule } from "./modules/knex/knex.module";
import { AMAModule } from "./modules/ama/ama.module";
import { session } from "telegraf";
import { ScheduleModule } from "@nestjs/schedule";
import { ScheduleServicesModule } from "./modules/schedule/schedule.module";

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
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => {
        if (!process.env.ADMIN_GROUP_ID) throw new Error("ADMIN_GROUP_ID is not set");
        if (!process.env.EN_PUBLIC_GROUP_ID) throw new Error("EN_PUBLIC_GROUP_ID is not set");
        if (!process.env.AR_PUBLIC_GROUP_ID) throw new Error("AR_PUBLIC_GROUP_ID is not set");
        if (!process.env.BOT_USERNAME) throw new Error("BOT_USERNAME is not set");
        if (!process.env.BOT_OWNER_ID) throw new Error("BOT_OWNER_ID is not set");
        return config as {
          ADMIN_GROUP_ID: string;
          EN_PUBLIC_GROUP_ID: string;
          AR_PUBLIC_GROUP_ID: string;
          BOT_USERNAME: string;
          BOT_OWNER_ID: string;
        };
      },
    }),
    ScheduleModule.forRoot(),
    TelegrafModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const token = configService.get<string>("TELEGRAM_BOT_TOKEN");
        if (!token) {
          throw new Error("TELEGRAM_BOT_TOKEN is not defined in the environment variables");
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
          middlewares: [session(), new PrivateChatMiddleware().use()],
        };
      },
      inject: [ConfigService],
    }),
    WelcomeModule,
    HelpModule,
    KnexModule,
    AMAModule,
    ScheduleServicesModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
