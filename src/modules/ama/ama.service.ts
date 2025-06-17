import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { ConfigService } from "@nestjs/config";
import { Action, Command, Update } from "nestjs-telegraf";
import { handleNewAMA } from "./helper/new-ama";
import { handlePublishAMA } from "./helper/publish-ama";
import { AMA_COMMANDS, AMA_HASHTAG } from "./ama.constants";
import { KnexService } from "../knex/knex.service";

@Update()
@Injectable()
export class AMAService {
  constructor(
    private readonly config: ConfigService,
    private readonly knexService: KnexService
  ) {}

  // Insert the AMA details into the database
  async createAMA(
    amaNumber: number,
    amaName: string,
    topicId: number
  ): Promise<void> {
    await this.knexService.knex("ama").insert({
      ama_no: amaNumber,
      title: amaName,
      topic_id: topicId,
      hashtag: `#${AMA_HASHTAG}${amaNumber}`,
    });
  }

  // Create a new AMA
  @Command(AMA_COMMANDS.NEW)
  async newAMA(ctx: Context): Promise<void> {
    await handleNewAMA(ctx);
  }

  // Publish the AMA to the public group
  @Action(/publish_ama_(\d+)_(.+)/)
  async publishAMA(ctx: Context): Promise<void> {
    const adminGroupId = this.config.get<string>("ADMIN_GROUP_ID")!;
    const publicGroupId = this.config.get<string>("PUBLIC_GROUP_ID")!;

    await handlePublishAMA(
      ctx,
      adminGroupId,
      publicGroupId,
      this.createAMA.bind(this)
    );
  }
}
