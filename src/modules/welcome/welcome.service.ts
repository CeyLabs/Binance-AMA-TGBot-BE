/**
 * @fileoverview Service for handling welcome-related functionality in the Telegram bot
 * @module welcome.service
 */

import { Injectable } from "@nestjs/common";
import { Update } from "nestjs-telegraf";

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
}
