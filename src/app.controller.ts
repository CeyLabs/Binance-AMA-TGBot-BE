/**
 * @fileoverview Root controller for the Template Telegram Bot
 * @module app.controller
 */

import { Update } from "nestjs-telegraf";
import { AppService } from "./app.service";
import { Controller, Get } from "@nestjs/common";

/**
 * Root controller class that handles base-level Telegram bot updates
 * @class AppController
 * @description Serves as the main controller for handling Telegram bot updates
 * and delegating to specific feature controllers
 */
@Update()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development'
    };
  }
}
