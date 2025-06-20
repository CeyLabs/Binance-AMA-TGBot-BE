import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { ConfigService } from "@nestjs/config";
import { Action, Command, On, Update } from "nestjs-telegraf";
import { handleNewAMA } from "./new-ama/new-ama";
import {
  AMA_COMMANDS,
  AMA_DEFAULT_DATA,
  AMA_HASHTAG,
  CALLBACK_ACTIONS,
} from "./ama.constants";
import { KnexService } from "../knex/knex.service";
import { handleConfirmAMA } from "./new-ama/callbacks";
import { AMA, BotContext, OpenAIAnalysis } from "./types";
import {
  handleBroadcastNow,
  handleScheduleBroadcast,
} from "./new-ama/broadcast";
import { handleEditRequest } from "./helper/handleEditRequest";
import { EDITABLE_FIELDS } from "./helper/field-metadata";
import { handleConfirmEdit, handleEdit } from "./new-ama/edit-ama";
import { handleStartAMA } from "./start-ama/start-ama";
import { handleAMAQuestion } from "./start-ama/handle-questions";
import { getQuestionAnalysis } from "./helper/openai-utils";

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
      total_pool: AMA_DEFAULT_DATA.total_pool,
      reward: AMA_DEFAULT_DATA.reward,
      winner_count: AMA_DEFAULT_DATA.winner_count,
      form_link: AMA_DEFAULT_DATA.form_link,
      topic: topic || "Weekly AMA",
      hashtag: `#${AMA_HASHTAG}${sessionNo}`,
    });
  }

  // Get AMA details by session number
  async getAMABySessionNo(sessionNo: number): Promise<AMA | null> {
    const ama = await this.knexService
      .knex<AMA>("ama")
      .where({ session_no: sessionNo })
      .first();

    return ama || null;
  }

  // Get AMA by hashtag
  async getAMAByHashtag(hashtag: string): Promise<AMA | null> {
    const ama = await this.knexService
      .knex<AMA>("ama")
      .where({ hashtag })
      .first();
    return ama || null;
  }

  async getThreadIdBySessionNo(sessionNo: number): Promise<number | null> {
    const ama = await this.knexService
      .knex<AMA>("ama")
      .where({ session_no: sessionNo })
      .first("thread_id");
    return ama?.thread_id ?? null;
  }

  async isAMASessionExists(sessionNo: number): Promise<boolean> {
    const session = await this.getAMABySessionNo(sessionNo);
    return Boolean(session);
  }

  // Update an existing AMA
  async updateAMA(sessionNo: number, updates: Partial<AMA>): Promise<boolean> {
    const session = await this.getAMABySessionNo(sessionNo);
    if (!session) return false;

    await this.knexService
      .knex("ama")
      .where({ session_no: sessionNo })
      .update({
        ...updates,
        updated_at: new Date(),
      });

    return true;
  }

  // Get all scheduled AMAs that are due for broadcasting
  async getScheduledAMAsToBroadcast(now: Date): Promise<AMA[]> {
    return this.knexService
      .knex<AMA>("ama")
      .whereNotNull("scheduled_at")
      .where("scheduled_at", "<=", now)
      .where("status", "scheduled");
  }

  async getAnalysis(
    question: string,
    topic?: string
  ): Promise<OpenAIAnalysis | string> {
    return getQuestionAnalysis(question, topic);
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

  // Start a new AMA session (/startama 60)
  @Command(AMA_COMMANDS.START)
  async startAMA(ctx: Context): Promise<void> {
    const adminGroupId = this.config.get<string>("ADMIN_GROUP_ID")!;
    await handleStartAMA(
      ctx,
      adminGroupId,
      this.getAMABySessionNo.bind(this),
      this.updateAMA.bind(this)
    );
  }

  // confirm-ama_(sessionNo)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.CONFIRM}_(\\d+)$`))
  async confirmAMA(ctx: Context): Promise<void> {
    await handleConfirmAMA(ctx);
  }

  // broadcast-now_(sessionNo)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.BROADCAST_NOW}_(\\d+)$`))
  async broadcastNow(ctx: Context): Promise<void> {
    const publicGroupId = this.config.get<string>("PUBLIC_GROUP_ID")!;
    await handleBroadcastNow(
      ctx,
      publicGroupId,
      this.getAMABySessionNo.bind(this),
      this.updateAMA.bind(this)
    );
  }

  // schedule-broadcast_(sessionNo)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.SCHEDULE_BROADCAST}_(\\d+)$`))
  async scheduleBroadcast(
    ctx: Context & { match: RegExpExecArray }
  ): Promise<void> {
    await handleScheduleBroadcast(
      ctx,
      this.getAMABySessionNo.bind(this),
      this.updateAMA.bind(this)
    );
  }

  // edit-date_(sessionNo)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.EDIT_DATE}_(\\d+)$`))
  async editDate(ctx: BotContext) {
    return handleEditRequest(
      ctx,
      "date",
      CALLBACK_ACTIONS.EDIT_DATE,
      this.getAMABySessionNo.bind(this)
    );
  }

  // edit-time_(sessionNo)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.EDIT_TIME}_(\\d+)$`))
  async editTime(ctx: BotContext) {
    return handleEditRequest(
      ctx,
      "time",
      CALLBACK_ACTIONS.EDIT_TIME,
      this.getAMABySessionNo.bind(this)
    );
  }

  // confirm-edit_(sessionNo)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.EDIT_CONFIRM}_(\\d+)$`))
  async confirmEdit(ctx: BotContext): Promise<void> {
    await handleConfirmEdit(
      ctx,
      this.updateAMA.bind(this),
      this.getAMABySessionNo.bind(this)
    );
  }

  // edit-cancel_(sessionNo)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.EDIT_CANCEL}_(\\d+)$`))
  async cancelEdit(ctx: BotContext): Promise<void> {
    if (!ctx.session.editMode) {
      await ctx.reply("⚠️ No pending update to cancel.");
      return;
    }
    const { field } = ctx.session.editMode || {};
    const column = EDITABLE_FIELDS[field].column;
    delete ctx.session.editMode;
    await ctx.reply(`${column} update cancelled.`);
  }

  @On("text")
  async handleText(ctx: BotContext): Promise<void> {
    const adminGroupId = this.config.get<string>("ADMIN_GROUP_ID")!;
    const publicGroupId = this.config.get<string>("PUBLIC_GROUP_ID")!;
    const chatID = ctx.chat?.id.toString();

    if (chatID === adminGroupId) {
      await handleEdit(ctx);
    } else if (chatID === publicGroupId) {
      await handleAMAQuestion(
        ctx,
        adminGroupId,
        this.getAMAByHashtag.bind(this),
        this.getAnalysis.bind(this)
      );
    } else {
      await ctx.reply("This command is not available in this chat.");
    }
  }
}
