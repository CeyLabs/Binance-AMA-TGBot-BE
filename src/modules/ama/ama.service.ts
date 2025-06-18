import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { ConfigService } from "@nestjs/config";
import { Action, Command, Update } from "nestjs-telegraf";
import { handleNewAMA } from "./helper/new-ama";
import {
  AMA_COMMANDS,
  AMA_DEFAULT_DATA,
  AMA_HASHTAG,
  CALLBACK_ACTIONS,
} from "./ama.constants";
import { KnexService } from "../knex/knex.service";
import { handleBroadcastNow, handleConfirmAMA } from "./helper/actions";
import { AMA } from "./helper/types";

@Update()
@Injectable()
export class AMAService {
  constructor(
    private readonly config: ConfigService,
    private readonly knexService: KnexService
  ) {}

  // Insert the AMA details into the database
  // prettier-ignore
  async createAMA( sessionNo: number, topic?: string): Promise<void> {
    await this.knexService.knex("ama").insert({
      session_no: sessionNo,
      language: "en",
      date: AMA_DEFAULT_DATA.date,
      time: AMA_DEFAULT_DATA.time,
      reward: AMA_DEFAULT_DATA.reward,
      winner_count: AMA_DEFAULT_DATA.winner_count,
      form_link: AMA_DEFAULT_DATA.form_link,
      topic: topic || "Weekly AMA",
      hashtag: `#${AMA_HASHTAG}${sessionNo}`,
    });
  }

  // Check if the AMA session number already exists
  async isAMASessionExists(sessionNo: number): Promise<boolean> {
    const exists = await this.knexService
      .knex("ama")
      .where({ session_no: sessionNo })
      .first("id");

    return Boolean(exists);
  }

  // Get AMA details by session number
  async getAMABySessionNo(sessionNo: number): Promise<AMA | null> {
    const ama = await this.knexService
      .knex<AMA>("ama")
      .where({ session_no: sessionNo })
      .first();

    return ama || null;
  }

  // Create a new AMA
  @Command(AMA_COMMANDS.NEW)
  async newAMA(ctx: Context): Promise<void> {
    await handleNewAMA(
      ctx,
      this.createAMA.bind(this),
      this.isAMASessionExists.bind(this)
    );
  }

  // confirm-ama_(amaNumber)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.CONFIRM}_(\\d+)$`))
  async confirmAMA(ctx: Context): Promise<void> {
    await handleConfirmAMA(ctx);
  }

  // broadcast-now_<amaNumber>
  @Action(new RegExp(`^${CALLBACK_ACTIONS.BROADCAST_NOW}_(\\d+)$`))
  async broadcastNow(ctx: Context): Promise<void> {
    const publicGroupId = this.config.get<string>("PUBLIC_GROUP_ID")!;
    await handleBroadcastNow(
      ctx,
      publicGroupId,
      this.getAMABySessionNo.bind(this)
    );
  }
}
