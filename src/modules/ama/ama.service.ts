import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { Action, Command, Update } from "nestjs-telegraf";
import { handleNewAMA } from "./helper/new-ama";
import { handlePublishAMA } from "./helper/publish-ama";
import { AMA_COMMANDS } from "./ama.constants";

@Update()
@Injectable()
export class AMAService {
  constructor() {}

  @Command(AMA_COMMANDS.NEW)
  async newAMA(ctx: Context): Promise<void> {
    await handleNewAMA(ctx);
  }

  @Action(/publish_ama_(\d+)_(.+)/)
  async publishAMA(ctx: Context): Promise<void> {
    await handlePublishAMA(ctx);
  }
}
