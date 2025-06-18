import { Injectable } from "@nestjs/common";
import { Context, Markup } from "telegraf";
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
import { AMA } from "./types";
import { handleBroadcastNow } from "./new-ama/broadcast";
import { validateCallbackPattern } from "./helper/utils";
import { buildAMAMessage } from "./helper/msg-builder";

export interface SessionData {
  editMode?: {
    sessionNo: number;
    field:
      | "date"
      | "time"
      | "sessionNo"
      | "reward"
      | "winnerCount"
      | "formLink"
      | "topic"
      | "guest";
    newValue?: string;
  };
}

export interface BotContext extends Context {
  session: SessionData;
}

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

  // Update an existing AMA
  async updateAMA(sessionNo: number, updates: Partial<AMA>): Promise<boolean> {
    const exists = await this.knexService
      .knex("ama")
      .where({ session_no: sessionNo })
      .first("id");

    if (!exists) return false;

    await this.knexService
      .knex("ama")
      .where({ session_no: sessionNo })
      .update({
        ...updates,
        updated_at: new Date(),
      });

    return true;
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
      this.getAMABySessionNo.bind(this)
    );
  }

  // edit-date_(sessionNo)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.EDIT_DATE}_(\\d+)$`))
  async editAMA(ctx: BotContext): Promise<void> {
    const result = await validateCallbackPattern(
      ctx,
      CALLBACK_ACTIONS.EDIT_DATE,
      new RegExp(`^${CALLBACK_ACTIONS.EDIT_DATE}_(\\d+)$`)
    );
    if (!result) return;
    const { sessionNo } = result;
    const ama = await this.getAMABySessionNo(sessionNo);
    if (!ama) {
      await ctx.reply(`AMA session number ${sessionNo} does not exist.`);
      return;
    }

    // Store temporary state
    ctx.session.editMode = {
      sessionNo,
      field: "date",
    };
    await ctx.reply(`Enter Date (dd/mm/yyyy)`);
  }

  @On("text")
  async handleEditText(ctx: BotContext): Promise<void> {
    const editMode = ctx.session.editMode;
    if (!editMode || editMode.field !== "date") return;

    if (!ctx.message || !("text" in ctx.message)) return;
    const input = ctx.message.text.trim();
    const match = input.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

    if (!match) {
      await ctx.reply("❌ Invalid format. Please enter date as dd/mm/yyyy.");
      return;
    }

    const [, day, month, year] = match;
    const isoDate = `${year}-${month}-${day}`;

    // Save new value for confirmation
    if (!ctx.session.editMode) return;
    ctx.session.editMode.newValue = isoDate;

    await ctx.reply(
      `✅ Updated Date: ${day}/${month}/${year}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("Cancel", "edit_cancel")],
        [Markup.button.callback("Confirm", "edit_date_confirm")],
      ])
    );
  }

  @Action("edit_date_confirm")
  async confirmDateUpdate(ctx: BotContext): Promise<void> {
    const { sessionNo, newValue } = ctx.session.editMode || {};
    if (!sessionNo || !newValue) {
      await ctx.reply("⚠️ No pending update found.");
      return;
    }

    const success = await this.updateAMA(sessionNo, { date: newValue });
    if (!success) {
      await ctx.reply("❌ Failed to update AMA. It may no longer exist.");
      return;
    }

    delete ctx.session.editMode;

    await ctx.reply("✅ Date updated successfully!");

    const updatedAMA = await this.getAMABySessionNo(sessionNo);
    if (updatedAMA) {
      const message = buildAMAMessage(updatedAMA); // use your formatter function
      await ctx.reply(message, { parse_mode: "HTML" });
    }
  }
}
