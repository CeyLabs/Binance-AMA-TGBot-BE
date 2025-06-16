/**
 * @fileoverview Root controller for the PizzaDao MoltoBene Telegram Bot
 * @module app.controller
 */

import { Update } from "nestjs-telegraf";
import { AppService } from "./app.service";
import { Controller } from "@nestjs/common";

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
}
