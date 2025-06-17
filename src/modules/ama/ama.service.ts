import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { ConfigService } from '@nestjs/config';
import { Action, Command, Update } from "nestjs-telegraf";
import { handleNewAMA } from "./helper/new-ama";
import { handlePublishAMA } from "./helper/publish-ama";
import { AMA_COMMANDS } from "./ama.constants";

@Update()
@Injectable()
export class AMAService {
  constructor(private readonly config: ConfigService) {}

  // Create a new AMA
  @Command(AMA_COMMANDS.NEW)
  async newAMA(ctx: Context): Promise<void> {
    await handleNewAMA(ctx);
  }

  // Publish the AMA to the public group
  @Action(/publish_ama_(\d+)_(.+)/)
  async publishAMA(ctx: Context): Promise<void> {
    const adminGroupId = this.config.get<string>('ADMIN_GROUP_ID')!;
    const publicGroupId = this.config.get<string>('PUBLIC_GROUP_ID')!;

    await handlePublishAMA(ctx, adminGroupId, publicGroupId);
  }
}
