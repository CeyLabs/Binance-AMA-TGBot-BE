/**
 * @fileoverview Welcome module for handling user onboarding and initial interactions
 * @module welcome.module
 */

import { Module } from "@nestjs/common";
import { WelcomeService } from "./welcome.service";

/**
 * Module that handles the welcome flow
 * @class WelcomeModule
 * @description Manages user welcome interactions
 */
@Module({
  imports: [],
  providers: [WelcomeService],
  exports: [WelcomeService],
})
export class WelcomeModule {}
