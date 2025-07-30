import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { ConfigService } from "@nestjs/config";
import { Action, Command, On, Start, Update } from "nestjs-telegraf";
import { handleNewAMA, handleNewAMACancel } from "./new-ama/new-ama";
import {
  AMA_COMMANDS,
  AMA_DEFAULT_DATA,
  AMA_HASHTAGS,
  CALLBACK_ACTIONS,
  EDIT_KEYS,
} from "./ama.constants";
import { KnexService } from "../knex/knex.service";
import { DbLoggerService } from "../../logger/db-logger.service";
import { handleConfirmAMA } from "./new-ama/helper/handle-confirm-ama";
import { handleBannerUpload } from "./new-ama/edit-ama";
import {
  AMA,
  BotContext,
  CreateScoreData,
  MessageWithAma,
  OpenAIAnalysis,
  ScoreWithUser,
  WinnerData,
  SupportedLanguage,
  UserDetails,
  User,
  UserRole,
  ScheduleType,
} from "./types";
import {
  handleBroadcastNow,
  handleConfirmSchedule,
  handleScheduleBroadcast,
  handleToggleSchedule,
} from "./new-ama/broadcast-ama";
import { handleEditRequest } from "./new-ama/helper/handle-edit-request";
import { EDITABLE_FIELDS } from "./new-ama/helper/field-metadata";
import { handleCancelEdit, handleConfirmEdit, handleEdit } from "./new-ama/edit-ama";
import { handleStartAMA, startAMAbyCallback } from "./start-ama/start-ama";
import { handleAMAQuestion } from "./start-ama/handle-questions";
import { getQuestionAnalysis } from "./helper/openai-utils";
import { UUID } from "crypto";
import { UUID_FRAGMENT, UUID_PATTERN } from "./helper/utils";
import {
  confirmWinnersCallback,
  endAMAbyCallback,
  handleEndAMA,
  handleWinnersBroadcast,
  resetWinnersCallback,
  selectWinnersCallback,
  cancelWinnersCallback,
} from "./end-ama/end.ama";
import {
  handleSelectWinners,
  selectWinnersByCallback,
  forceSelectWinnersCallback,
} from "./end-ama/select-winners";
import { handleDiscardUser } from "./end-ama/end.ama";
import * as dayjs from "dayjs";
import { handleStart } from "./claim-reward/claim-reward";
import { convertDateTimeToUTC, DATETIME_REGEX } from "src/modules/ama/helper/date-utils";
import { broadcastWinnersCallback, scheduleWinnersBroadcast } from "./end-ama/broadcast-winners";
import { blockIfNotAdminGroup } from "../../utils/command-utils";
import { PermissionsService } from "./permissions.service";

@Update()
@Injectable()
export class AMAService {
  constructor(
    private readonly config: ConfigService,
    private readonly knexService: KnexService,
    private readonly logger: DbLoggerService,
    private readonly permissionsService: PermissionsService,
  ) {}

  // Get bot owner ID from environment
  private getBotOwnerInfo(): { name: string; id: string } {
    const ownerId = this.config.get<string>("BOT_OWNER_ID");
    if (!ownerId) {
      throw new Error("BOT_OWNER_ID is not defined");
    }
    const ownerName = this.config.get<string>("BOT_OWNER_NAME");
    if (!ownerName) {
      throw new Error("BOT_OWNER_NAME is not defined");
    }
    return { id: ownerId, name: ownerName };
  }

  // Resolve username to user ID by looking up in database
  async resolveUsernameToId(input: string): Promise<string | null> {
    // If it's already a numeric user ID, return it
    if (/^\d+$/.test(input)) {
      return input;
    }

    // If it starts with @, it's a username
    if (input.startsWith('@')) {
      const username = input.substring(1); // Remove the @ symbol
      const user = await this.knexService
        .knex<{ user_id: string }>("user")
        .where("username", username)
        .first();
      return user ? user.user_id : null;
    }

    // If it's just a plain username without @
    const user = await this.knexService
      .knex<{ user_id: string }>("user")
      .where("username", input)
      .first();
    return user ? user.user_id : null;
  }

  // Check if a question is a duplicate within the same AMA session
  async checkDuplicateQuestion(amaId: UUID, question: string): Promise<boolean> {
    if (!question || question.trim() === "") return false;

    // Normalize the input question
    const normalizedQuestion = question.toLowerCase().trim();

    // Find any existing messages with the same normalized question text
    const result = await this.knexService
      .knex("message")
      .where({ ama_id: amaId, processed: true }) // Only check with processed messages
      .whereRaw("LOWER(TRIM(question)) = ?", [normalizedQuestion])
      .count("* as count")
      .first();

    // Convert count to number and check if > 0
    const count = result ? parseInt(result.count as string, 10) : 0;
    return count > 0;
  }

  // <<------------------------------------ Database Operations ------------------------------------>>

  // Insert the AMA details into the database
  // prettier-ignore
  async createAMA( sessionNo: number, language:SupportedLanguage, topic?: string): Promise<UUID> {
    const data = await this.knexService.knex("ama").insert({
      session_no: sessionNo,
      language: language,
      datetime: convertDateTimeToUTC(AMA_DEFAULT_DATA.date, AMA_DEFAULT_DATA.time),
      total_pool: AMA_DEFAULT_DATA.total_pool,
      reward: AMA_DEFAULT_DATA.reward,
      winner_count: AMA_DEFAULT_DATA.winner_count,
      form_link: AMA_DEFAULT_DATA.form_link,
      topic: topic || "Weekly AMA",
      hashtag: `#${AMA_HASHTAGS[language]}${sessionNo}`,
    }).returning("id");
    if (data.length === 0) {
      throw new Error("Failed to create AMA session");
    }
    return (data[0] as { id: UUID }).id; // Return the UUID of the created AMA
  }

  async deleteAMA(id: UUID): Promise<boolean> {
    const result = await this.knexService.knex("ama").where({ id }).del().returning("*");
    return result.length > 0;
  }

  async addScore(scoreData: CreateScoreData, name?: string, username?: string): Promise<boolean> {
    // First, ensure user exists in users table
    await this.upsertUser(scoreData.user_id, name, username);

    const data = await this.knexService
      .knex("message")
      .insert({
        ama_id: scoreData.ama_id,
        user_id: scoreData.user_id,
        question: scoreData.question,
        originality: scoreData.originality,
        clarity: scoreData.clarity,
        engagement: scoreData.engagement,
        score: scoreData.score,
      })
      .returning("*");
    return data.length > 0; // Return true if insert was successful
  }

  async upsertUser(user_id: string, name?: string, username?: string): Promise<void> {
    await this.knexService
      .knex("user")
      .insert({
        user_id,
        name: name || null,
        username: username || null,
        role: "regular",
      })
      .onConflict("user_id")
      .merge({
        name: name || null,
        username: username || null,
        updated_at: new Date(),
      });
  }

  async upsertUserFromContext(ctx: Context): Promise<void> {
    if (!ctx.from) return;
    await this.upsertUser(
      ctx.from.id.toString(),
      ctx.from.first_name,
      ctx.from.username ?? undefined,
    );
  }

  async updateUserRole(userId: string, role: UserRole): Promise<void> {
    // Prevent modification of bot owner permissions
    if (userId === this.getBotOwnerInfo().id) {
      throw new Error("Cannot modify bot owner permissions");
    }

    // Update existing user's role (user must already exist)
    const result = await this.knexService
      .knex("user")
      .where("user_id", userId)
      .update({ role, updated_at: new Date() });

    if (result === 0) {
      throw new Error("User not found in database");
    }
  }

  async subscribeUser(userId: string, language: SupportedLanguage): Promise<void> {
    console.log('language',language)
    await this.knexService
      .knex("user")
      .insert({
        user_id: userId,
        subscribed_groups: [language],
      })
      .onConflict("user_id")
      .merge({
        subscribed_groups: this.knexService.knex.raw(
          "array(SELECT DISTINCT unnest(coalesce(\"user\".subscribed_groups, ARRAY[]::text[])) UNION SELECT ?)",
          [language],
        ),
        updated_at: new Date(),
      });
  }

  async getSubscribedUsers(language: SupportedLanguage): Promise<User[]> {
    return this.knexService
      .knex<User>("user")
      .whereRaw("? = ANY(subscribed_groups)", [language]);
  }

  async getUserRole(userId: string): Promise<UserRole | null> {
    const user = await this.knexService
      .knex<{ role: UserRole }>("user")
      .where("user_id", userId)
      .first();
    return user ? user.role : null;
  }

  isBotOwner(userId: string): boolean {
    return userId === this.getBotOwnerInfo().id;
  }

  async isAdminOrOwner(userId: string): Promise<boolean> {
    const role = await this.getUserRole(userId);
    return role === "admin" || this.isBotOwner(userId);
  }

  async canUserAccessAMA(userId: string): Promise<boolean> {
    if (this.isBotOwner(userId)) return true;
    const role = await this.getUserRole(userId);
    return role ? this.permissionsService.canAccessActiveAMA(role) : false;
  }

  async canUserCreateAMA(userId: string): Promise<boolean> {
    if (this.isBotOwner(userId)) return true;
    const role = await this.getUserRole(userId);
    return role ? this.permissionsService.canCreateAMA(role) : false;
  }

  async canUserAccessNewAMA(userId: string): Promise<boolean> {
    if (this.isBotOwner(userId)) return true;
    const role = await this.getUserRole(userId);
    return role ? this.permissionsService.canAccessNewAMACommand(role) : false;
  }

  async canUserEditAnnouncements(userId: string): Promise<boolean> {
    if (this.isBotOwner(userId)) return true;
    const role = await this.getUserRole(userId);
    return role ? this.permissionsService.canEditAnnouncements(role) : false;
  }

  async canUserSelectWinners(userId: string): Promise<boolean> {
    if (this.isBotOwner(userId)) return true;
    const role = await this.getUserRole(userId);
    return role ? this.permissionsService.canAccessWinnerSelection(role) : false;
  }

  async canUserBroadcastAnnouncements(userId: string): Promise<boolean> {
    if (this.isBotOwner(userId)) return true;
    const role = await this.getUserRole(userId);
    return role ? this.permissionsService.canBroadcastAnnouncements(role) : false;
  }

  async addWinner(
    ama_id: UUID,
    user_id: string,
    message_id: UUID,
    rank: number,
  ): Promise<WinnerData | null> {
    const data = await this.knexService
      .knex("winner")
      .insert({
        ama_id,
        user_id,
        message_id,
        rank,
      })
      .returning("*");

    return data.length > 0 ? (data[0] as WinnerData) : null;
  }

  // Get AMA by ID
  async getAMAById(id: UUID): Promise<AMA | null> {
    const ama = await this.knexService.knex<AMA>("ama").where({ id }).first();
    return ama || null;
  }

  // Get all AMAs by session number
  async getAMAsBySessionNo(sessionNo: number): Promise<AMA[] | []> {
    const ama = await this.knexService
      .knex<AMA>("ama")
      .where({ session_no: sessionNo })
      .orderBy("created_at", "desc");

    return ama || [];
  }

  // Get all AMAs by hashtag
  async getAMAsByHashtag(hashtag: string): Promise<AMA[] | []> {
    const ama = await this.knexService
      .knex<AMA>("ama")
      .whereRaw("LOWER(hashtag) = LOWER(?)", [hashtag])
      .orderBy("created_at", "desc");
    return ama || [];
  }

  // Get AMA details by session number
  async getAMABySessionNoAndLang(
    sessionNo: number,
    language: SupportedLanguage,
  ): Promise<AMA | null> {
    const ama = await this.knexService
      .knex<AMA>("ama")
      .where({ session_no: sessionNo, language })
      .first();

    return ama || null;
  }

  async getAMABySessionNo(sessionNo: number): Promise<AMA | null> {
    const ama = await this.knexService.knex<AMA>("ama").where({ session_no: sessionNo }).first();
    return ama || null;
  }

  // Get AMA by hashtag
  async getAMAByHashtag(hashtag: string): Promise<AMA | null> {
    const ama = await this.knexService
      .knex<AMA>("ama")
      .whereRaw("LOWER(hashtag) = LOWER(?)", [hashtag])
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

  async isAMAExists(sessionNo: number, language: SupportedLanguage): Promise<boolean> {
    const session = await this.getAMABySessionNoAndLang(sessionNo, language);
    return Boolean(session);
  }

  // Update an existing AMA
  async updateAMA(id: UUID, updates: Partial<AMA>): Promise<boolean> {
    const session = await this.getAMAById(id);
    if (!session) return false;

    await this.knexService
      .knex("ama")
      .where({ id })
      .update({
        ...updates,
        updated_at: new Date(),
      });

    return true;
  }

  // Update banner for an AMA
  async updateBanner(amaId: UUID, file_id: string): Promise<AMA | null> {
    await this.knexService.knex<AMA>("ama").where("id", amaId).update({
      banner_file_id: file_id,
      updated_at: new Date(),
    });

    // Return the updated AMA
    return this.getAMAById(amaId);
  }

  // Get scores for a specific AMA
  async getScoresForAMA(id: UUID): Promise<ScoreWithUser[]> {
    return this.knexService
      .knex("message")
      .join("user", "message.user_id", "user.user_id")
      .select("message.*", "user.name", "user.username")
      .where("message.ama_id", id)
      .orderBy([
        { column: "message.score", order: "desc" },
        { column: "message.created_at", order: "asc" },
      ]);
  }

  // Get number of times user won in the past 3 months
  async winCount(userId: string, excludeAmaId?: UUID): Promise<{ wins: number }> {
    const oneMonthAgo = dayjs().subtract(1, "month").toDate();

    const query = this.knexService
      .knex<WinnerData>("winner")
      .where("user_id", userId)
      .andWhere("created_at", ">=", oneMonthAgo);

    if (excludeAmaId) {
      query.andWhereNot("ama_id", excludeAmaId);
    }

    const result = await query.count<{ count: string }>("id as count").first();

    const count = result ? parseInt(result.count, 10) : 0;
    return { wins: count };
  }

  async scheduleAMA(ama_id: UUID, scheduled_time: Date, type: ScheduleType): Promise<void> {
    await this.knexService.knex("schedule").insert({
      ama_id,
      scheduled_time,
      type,
    });
  }

  // Get all AMAs that are scheduled within the last 10 minutes
  async getDueScheduledTimes() {
    const scheduleEntries = await this.knexService
      .knex("schedule")
      .where("scheduled_time", "<=", this.knexService.knex.fn.now())
      .select("id", "ama_id", "type");
    return scheduleEntries.map((row: { id: UUID; ama_id: UUID; type: ScheduleType }) => ({
      scheduleId: row.id,
      amaId: row.ama_id,
      type: row.type,
    }));
  }

  // Delete a scheduled time by schedule ID
  async deleteScheduledTime(scheduleId: UUID): Promise<void> {
    await this.knexService.knex("schedule").where({ id: scheduleId }).del();
  }

  // Get winners by AMA ID
  async getWinnersByAMA(amaId: UUID): Promise<WinnerData[]> {
    return this.knexService
      .knex<WinnerData>("winner")
      .where({ ama_id: amaId })
      .orderBy("rank", "asc");
  }

  // Get winners by AMA ID with user details
  async getWinnersWithUserDetails(amaId: UUID): Promise<ScoreWithUser[]> {
    return this.knexService
      .knex("winner")
      .join("user", "winner.user_id", "user.user_id")
      .select("winner.*", "user.name", "user.username")
      .where({ ama_id: amaId })
      .orderBy("rank", "asc");
  }

  // Get user details by ID
  async getUserById(userId: string): Promise<UserDetails | undefined> {
    return this.knexService
      .knex<UserDetails>("user")
      .select("user_id", "username", "name")
      .where({ user_id: userId })
      .first();
  }

  async getUserDisplayName(userId: string): Promise<string> {
    const user = await this.getUserById(userId);
    if (!user) return userId;
    if (user.username) return `@${user.username}`;
    if (user.name) return user.name;
    return userId;
  }

  async getNonRegularUsers(): Promise<Omit<User, "username" | "subscribed_groups" | "created_at" | "updated_at">[]> {
    return this.knexService
      .knex<User>("user")
      .select("user_id", "name", "role")
      .where("role", "!=", "regular")
      .orderBy("role", "asc")
      .orderBy("name", "asc")
      .limit(100); // Reasonable limit for non-regular users
  }

  // Methods for message processing
  async getUnprocessedMessages(batchSize: number): Promise<MessageWithAma[]> {
    return this.knexService
      .knex("message")
      .join("ama", "message.ama_id", "ama.id")
      .select("message.*", "ama.thread_id", "ama.topic")
      .where("message.processed", false)
      .orderBy("message.created_at", "asc")
      .limit(batchSize);
  }

  async updateMessageForwardedId(messageId: UUID, forwardedMsgId: number): Promise<void> {
    await this.knexService.knex("message").where("id", messageId).update({
      forwarded_msg_id: forwardedMsgId,
    });
  }

  async updateMessageWithAnalysis(
    messageId: UUID,
    analysisData: {
      originality: number;
      clarity: number;
      engagement: number;
      score: number;
      processed: boolean;
    },
  ): Promise<void> {
    await this.knexService.knex("message").where("id", messageId).update(analysisData);
  }

  async markMessageAsProcessed(messageId: UUID): Promise<void> {
    await this.knexService.knex("message").where("id", messageId).update({
      processed: true,
    });
  }

  async storeAMAQuestion(
    amaId: UUID,
    userId: string,
    question: string,
    chatId: number,
    messageId: number,
    name?: string,
    username?: string,
  ): Promise<void> {
    // First, ensure user exists in the user table
    await this.upsertUser(userId, name, username);

    // Store the message in the database
    await this.knexService.knex("message").insert({
      ama_id: amaId,
      user_id: userId,
      question: question,
      chat_id: chatId,
      tg_msg_id: messageId,
      originality: 0,
      clarity: 0,
      engagement: 0,
      score: 0,
      processed: false, // Mark as unprocessed so the cron job will pick it up
    });
  }

  // Delete all the winners for a specific AMA
  async deleteWinnersByAMA(amaId: UUID): Promise<boolean> {
    const result = await this.knexService
      .knex("winner")
      .where({ ama_id: amaId })
      .del()
      .returning("*");
    return result.length > 0; // Return true if winners were deleted
  }

  // <<------------------------------------ Analysis ------------------------------------>>

  async getAnalysis(question: string, topic?: string): Promise<OpenAIAnalysis | string> {
    return getQuestionAnalysis(question, topic);
  }

  // <<------------------------------------ Commands ------------------------------------>>

  // Handle /start command with deep links for claiming rewards
  @Start()
  async start(ctx: BotContext): Promise<void> {
    const adminGroupId = this.config.get<string>("ADMIN_GROUP_ID")!;
    if (await blockIfNotAdminGroup(ctx, adminGroupId)) return;

    await this.upsertUserFromContext(ctx);
    await handleStart(
      ctx,
      this.getAMAById.bind(this) as (id: UUID) => Promise<AMA | null>,
      this.getWinnersByAMA.bind(this) as (amaId: UUID) => Promise<WinnerData[]>,
      this.subscribeUser.bind(this) as (userId: string, lang: SupportedLanguage) => Promise<void>,
    );
  }

  // Create a new AMA
  @Command(AMA_COMMANDS.NEW)
  async newAMA(ctx: BotContext): Promise<void> {
    const adminGroupId = this.config.get<string>("ADMIN_GROUP_ID")!;
    if (await blockIfNotAdminGroup(ctx, adminGroupId)) return;

    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserAccessNewAMA(fromId))) {
      await ctx.reply("❌ You are not authorized to access AMA management.", ctx.message?.message_id ? { reply_parameters: { message_id: ctx.message.message_id } } : {});
      return;
    }

    await handleNewAMA(
      ctx,
      this.createAMA.bind(this) as (
        sessionNo: number,
        language: SupportedLanguage,
        topic?: string,
      ) => Promise<UUID>,
      this.isAMAExists.bind(this) as (
        sessionNo: number,
        language: SupportedLanguage,
      ) => Promise<boolean>,
      this.getAMABySessionNoAndLang.bind(this) as (
        sessionNo: number,
        language: SupportedLanguage,
      ) => Promise<AMA | null>,
      this.canUserCreateAMA.bind(this) as (userId: string) => Promise<boolean>,
      this.logger,
    );
  }

  // Start the AMA (/startama 60)
  @Command(AMA_COMMANDS.START)
  async startAMA(ctx: Context): Promise<void> {
    const adminGroupId = this.config.get<string>("ADMIN_GROUP_ID")!;
    if (await blockIfNotAdminGroup(ctx, adminGroupId)) return;

    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserAccessAMA(fromId))) {
      await ctx.reply("❌ You are not authorized to start AMAs.", ctx.message?.message_id ? { reply_parameters: { message_id: ctx.message.message_id } } : {});
      return;
    }

    const groupIds = {
      public: {
        en: this.config.get<string>("EN_PUBLIC_GROUP_ID")!,
        ar: this.config.get<string>("AR_PUBLIC_GROUP_ID")!,
      },
      admin: this.config.get<string>("ADMIN_GROUP_ID")!,
    };
    await handleStartAMA(
      ctx,
      groupIds,
      this.getAMAsBySessionNo.bind(this) as (sessionNo: number) => Promise<AMA[]>,
      this.updateAMA.bind(this) as (id: UUID, data: Partial<AMA>) => Promise<boolean>,
      this.logger,
    );
  }

  // End the AMA (/endama 60)
  @Command(AMA_COMMANDS.END)
  async endAMA(ctx: BotContext): Promise<void> {
    const adminGroupId = this.config.get<string>("ADMIN_GROUP_ID")!;
    if (await blockIfNotAdminGroup(ctx, adminGroupId)) return;

    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserAccessAMA(fromId))) {
      await ctx.reply("❌ You are not authorized to end AMAs.", ctx.message?.message_id ? { reply_parameters: { message_id: ctx.message.message_id } } : {});
      return;
    }

    await handleEndAMA(
      ctx,
      this.getAMAsBySessionNo.bind(this) as (sessionNo: number) => Promise<AMA[]>,
      this.getScoresForAMA.bind(this) as (amaId: UUID) => Promise<ScoreWithUser[]>,
      this.winCount.bind(this) as (
        userId: string,
        excludeAmaId?: UUID,
      ) => Promise<{ wins: number }>,
    );
  }

  @Command(AMA_COMMANDS.SELECT_WINNERS)
  async handleSelectWinnersCommand(ctx: Context): Promise<void> {
    const adminGroupId = this.config.get<string>("ADMIN_GROUP_ID")!;
    if (await blockIfNotAdminGroup(ctx, adminGroupId)) return;

    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserSelectWinners(fromId))) {
      await ctx.reply("❌ You are not authorized to select winners.", ctx.message?.message_id ? { reply_parameters: { message_id: ctx.message.message_id } } : {});
      return;
    }

    await handleSelectWinners(
      ctx,
      this.getAMAsBySessionNo.bind(this) as (sessionNo: number) => Promise<AMA[]>,
      this.getScoresForAMA.bind(this) as (amaId: UUID) => Promise<ScoreWithUser[]>,
      this.getWinnersByAMA.bind(this) as (amaId: UUID) => Promise<WinnerData[]>,
      this.getUserById.bind(this) as (userId: string) => Promise<UserDetails | undefined>,
      this.winCount.bind(this) as (
        userId: string,
        excludeAmaId?: UUID,
      ) => Promise<{ wins: number }>,
    );
  }



  @Command("grantadmin")
  async grantAdmin(ctx: BotContext): Promise<void> {
    await this.handlePromoteCommand(ctx, "admin");
  }

  @Command("granthost")
  async promoteAdminNew(ctx: BotContext): Promise<void> {
    await this.handlePromoteCommand(ctx, "host");
  }

  @Command("granteditor")
  async promoteAdminEdit(ctx: BotContext): Promise<void> {
    await this.handlePromoteCommand(ctx, "editor");
  }

  @Command("grantama")
  async promoteToAMA(ctx: BotContext): Promise<void> {
    await this.handlePromoteCommand(ctx, "ama");
  }

  @Command("grantregular")
  async demoteToRegular(ctx: BotContext): Promise<void> {
    await this.handlePromoteCommand(ctx, "regular");
  }

  @Command("access")
  async handlePermissionsCommand(ctx: Context): Promise<void> {
    const adminGroupId = this.config.get<string>("ADMIN_GROUP_ID")!;
    if (await blockIfNotAdminGroup(ctx, adminGroupId)) return;

    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId) {
      await ctx.reply("Unable to identify user.", ctx.message?.message_id ? { reply_parameters: { message_id: ctx.message.message_id } } : {});
      return;
    }

    const userRole = await this.getUserRole(fromId);
    const isBotOwner = this.isBotOwner(fromId);
    if (userRole !== "admin" && !isBotOwner) {
      await ctx.reply("❌ You are not authorized to view permissions.", ctx.message?.message_id ? { reply_parameters: { message_id: ctx.message.message_id } } : {});
      return;
    }

    try {
      const nonRegularUsers = await this.getNonRegularUsers();
      
      if (nonRegularUsers.length === 0) {
        await ctx.reply("No non-regular users found.");
        return;
      }

      // Group users by role and create user-friendly display
      const getRoleName = (role: string): string => {
        switch (role) {
          case 'admin': return 'Admin(s)';
          case 'ama': return 'AMA Manager(s)';
          case 'editor': return 'Editor(s)';
          case 'host': return 'Host(s)';
          default: return role;
        }
      };

      const roleOrder = ['admin', 'ama', 'editor', 'host'];
      const usersByRole = nonRegularUsers.reduce((acc, user) => {
        if (!acc[user.role]) acc[user.role] = [];
        acc[user.role].push(user);
        return acc;
      }, {} as Record<string, typeof nonRegularUsers>);

      // Show bot owner first
      const botOwnerInfo = this.getBotOwnerInfo();
      const displayName = `${botOwnerInfo.name} (<code>${botOwnerInfo.id}</code>)`
      let message = `<b>Bot Owner:</b> ${displayName}\n\n`;
      
      for (const role of roleOrder) {
        const usersInRole = usersByRole[role];
        if (usersInRole && usersInRole.length > 0) {
          // Filter out bot owner from other roles display since we show them separately
          const filteredUsers = usersInRole.filter(user => user.user_id !== botOwnerInfo.id);
          if (filteredUsers.length > 0) {
            message += `<b>${getRoleName(role)}</b>\n`;
            for (const user of filteredUsers) {
              const displayName = user.name ? `${user.name} (<code>${user.user_id}</code>)` : `User <code>${user.user_id}</code>`;
              message += `• ${displayName}\n`;
            }
            message += '\n';
          }
        }
      }

      await ctx.reply(message, { parse_mode: "HTML" });
    } catch (error) {
      console.error("Error fetching permissions:", error);
      await ctx.reply("An error occurred while fetching permissions.");
    }
  }


  private async handlePromoteCommand(ctx: BotContext, targetRole: UserRole): Promise<void> {
    const adminGroupId = this.config.get<string>("ADMIN_GROUP_ID")!;
    if (await blockIfNotAdminGroup(ctx, adminGroupId)) return;
    
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId) {
      await ctx.reply("Unable to identify user.", ctx.message?.message_id ? { reply_parameters: { message_id: ctx.message.message_id } } : {});
      return;
    }

    const promoterRole = await this.getUserRole(fromId);
    if (!promoterRole) {
      await ctx.reply("You are not registered in the system.", ctx.message?.message_id ? { reply_parameters: { message_id: ctx.message.message_id } } : {});
      return;
    }

    const text = ctx.message && "text" in ctx.message ? ctx.message.text : "";
    const targetInput = text.split(" ")[1];
    let targetId: string | null = null;
    
    // Handle reply to message
    if (!targetInput && ctx.message && "reply_to_message" in ctx.message) {
      const reply = ctx.message.reply_to_message;
      if (reply?.from?.id) {
        targetId = reply.from.id.toString();
        await this.upsertUser(targetId, reply.from.first_name, reply.from.username ?? undefined);
      }
    }
    // Handle username or user ID input
    else if (targetInput) {
      targetId = await this.resolveUsernameToId(targetInput);
      if (!targetId) {
        await ctx.reply(`User not found. Please ensure the user has interacted with the bot before or use their Telegram user ID.`);
        return;
      }
    }

    if (!targetId) {
      await ctx.reply(`Usage: /${targetRole} <tg_userid|@username> or reply to a user with /${targetRole}`);
      return;
    }

    // Validate that we have a numeric user ID
    if (!/^\d+$/.test(targetId)) {
      await ctx.reply("Invalid user ID format. User ID must be numeric.");
      return;
    }

    // Check if user exists in database (must have interacted with bot before)
    const userExists = await this.getUserById(targetId);
    if (!userExists) {
      await ctx.reply("User not found. The user must have interacted with the bot before their role can be changed. Make sure they have executed /start on bot or sent a message in admin group!");
      return;
    }

    // Prevent users from modifying their own roles
    if (targetId === fromId) {
      await ctx.reply("You cannot modify your own role.");
      return;
    }

    const currentRole = await this.getUserRole(targetId);
    
    // Check if promoter has permission to modify this user
    // Only bot owner and admin role can use grant commands
    const isBotOwner = this.isBotOwner(fromId);
    const isAdmin = promoterRole === 'admin';
    
    if (!isBotOwner && !isAdmin) {
      await ctx.reply("Only admins and the bot owner can manage user roles.", ctx.message?.message_id ? { reply_parameters: { message_id: ctx.message.message_id } } : {});
      return;
    }
    
    if (currentRole === targetRole) {
      const name = await this.getUserDisplayName(targetId);
      await ctx.reply(`User ${name} already has the ${targetRole} role.`);
      return;
    }

    try {
      await this.updateUserRole(targetId, targetRole);
      const name = await this.getUserDisplayName(targetId);
      
      // Determine if this is a promotion or demotion
      const roleComparison = this.permissionsService.compareRoles(currentRole, targetRole);
      if (roleComparison > 0) {
        await ctx.reply(`User ${name} has been promoted to ${targetRole} role.`);
      } else if (roleComparison < 0) {
        await ctx.reply(`User ${name} has been demoted to ${targetRole} role.`);
      } else {
        await ctx.reply(`User ${name} role has been changed to ${targetRole}.`);
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === "Cannot modify bot owner permissions") {
          await ctx.reply("Owner permissions cannot be modified.");
        } else {
          await ctx.reply("An error occurred while updating user role.");
          console.error("Error updating user role:", error);
        }
      } else {
        await ctx.reply("An error occurred while updating user role.");
        console.error("Error updating user role:", error);
      }
    }
  }

  // <<------------------------------------ Callback Actions ------------------------------------>>

  // Console log all callback actions (For testing purposes)
  // @Action(/.*/)
  // async handleCallback(ctx: Context): Promise<void> {
  //   if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
  //     console.log("Callback Action:", ctx.callbackQuery.data);
  //   }
  //   await ctx.answerCbQuery("Action received.");
  // }

  // confirm-ama_(id)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.CONFIRM}_${UUID_PATTERN}`, "i"))
  async confirmAMA(ctx: Context): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserCreateAMA(fromId))) {
      await ctx.answerCbQuery("❌ You are not authorized to confirm AMA creation.", { show_alert: true });
      return;
    }
    await handleConfirmAMA(ctx);
  }

  // broadcast-now_(id)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.BROADCAST_NOW}_${UUID_PATTERN}`, "i"))
  async broadcastNow(ctx: Context): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserBroadcastAnnouncements(fromId))) {
      await ctx.reply("❌ You are not authorized to broadcast announcements.");
      return;
    }
    const publicGroupIds = {
      en: this.config.get<string>("EN_PUBLIC_GROUP_ID")!,
      ar: this.config.get<string>("AR_PUBLIC_GROUP_ID")!,
    };

    await handleBroadcastNow(
      ctx,
      publicGroupIds,
      this.getAMAById.bind(this) as (id: UUID) => Promise<AMA | null>,
      this.updateAMA.bind(this) as (id: UUID, updates: Partial<AMA>) => Promise<boolean>,
      this.getSubscribedUsers.bind(this) as (lang: SupportedLanguage) => Promise<User[]>,
      this.config.get<string>("BOT_USERNAME")!,
    );
  }

  // schedule-broadcast_(sessionNo)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.SCHEDULE_BROADCAST}_${UUID_PATTERN}`, "i"))
  async scheduleBroadcast(ctx: BotContext): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserBroadcastAnnouncements(fromId))) {
      await ctx.reply("❌ You are not authorized to broadcast announcements.");
      return;
    }

    await handleScheduleBroadcast(
      ctx,
      this.getAMAById.bind(this) as (id: UUID) => Promise<AMA | null>,
    );
  }

  @Action(new RegExp(`^${CALLBACK_ACTIONS.CONFIRM_SCHEDULE}_${UUID_PATTERN}`, "i"))
  async confirmBroadcast(ctx: BotContext): Promise<void> {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;
    const callbackData = ctx.callbackQuery.data;
    const match = callbackData.match(`^${CALLBACK_ACTIONS.CONFIRM_SCHEDULE}_${UUID_PATTERN}$`);

    if (!match) {
      await ctx.answerCbQuery("Invalid confirmation action.");
      return;
    }

    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserBroadcastAnnouncements(fromId))) {
      await ctx.reply("❌ You are not authorized to broadcast announcements.");
      return;
    }

    const amaId = match[1];
    const ama = await this.getAMAById(amaId as UUID);

    if (!ama) {
      await ctx.reply("AMA not found.");
      return;
    }

    // Proceed with the broadcast logic
    await handleConfirmSchedule(
      ctx,
      amaId as UUID,
      this.getAMAById.bind(this) as (id: UUID) => Promise<AMA | null>,
      this.scheduleAMA.bind(this) as (id: UUID, time: Date) => Promise<void>,
    );
  }

  // Handle `toggle_5m_<amaId>` etc.
  @Action(new RegExp(`^${CALLBACK_ACTIONS.TOGGLE_SCHEDULE}_(\\w+)_(${UUID_PATTERN})$`))
  async onToggleSchedule(ctx: BotContext) {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserBroadcastAnnouncements(fromId))) {
      await ctx.reply("❌ You are not authorized to broadcast announcements.");
      return;
    }

    await handleToggleSchedule(
      ctx,
      this.getAMAById.bind(this) as (id: UUID) => Promise<AMA | null>,
    );
  }

  // Handle disabled toggle attempts
  @Action(new RegExp(`^${CALLBACK_ACTIONS.TOGGLE_DISABLED}_(\\w+)_(${UUID_PATTERN})$`))
  async onToggleDisabled(ctx: BotContext) {
    await ctx.answerCbQuery("⏰ Cannot toggle - this time has already passed!");
  }

  // edit-(date|time|sessionNo|reward|winnerCount|formLink|topic|guest)_(id)
  @Action(new RegExp(`^edit-(${Object.values(EDIT_KEYS).join("|")})_${UUID_PATTERN}`, "i"))
  async handleGenericEdit(ctx: BotContext) {
    if (!ctx.callbackQuery || !("data" in ctx.callbackQuery)) return;
    const callbackData = ctx.callbackQuery.data;
    if (!callbackData) return;

    const match = callbackData.match(
      new RegExp(`^edit-(${Object.values(EDIT_KEYS).join("|")})_(${UUID_PATTERN})$`, "i"),
    );

    if (!match) return;

    const [, field] = match;

    if (!(field in EDITABLE_FIELDS)) {
      await ctx.reply("⚠️ Invalid field for editing.");
      return;
    }

    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserEditAnnouncements(fromId))) {
      await ctx.answerCbQuery("❌ You are not authorized to edit AMA announcements.", { show_alert: true });
      return;
    }

    // Add the parent message ID to the editingAnnouncementMsgId
    if (ctx.callbackQuery.message && "message_id" in ctx.callbackQuery.message) {
      ctx.session.editingAnnouncementMsgId = ctx.callbackQuery.message.message_id;
    }

    return handleEditRequest(
      ctx,
      field,
      `edit-${field}`,
      this.getAMAById.bind(this) as (id: UUID) => Promise<AMA | null>,
    );
  }

  // confirm-edit_(sessionNo)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.EDIT_CONFIRM}_${UUID_PATTERN}`, "i"))
  async confirmEdit(ctx: BotContext): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserEditAnnouncements(fromId))) {
      await ctx.answerCbQuery("❌ You are not authorized to edit AMA announcements.", { show_alert: true });
      return;
    }
    await handleConfirmEdit(
      ctx,
      this.updateAMA.bind(this) as (id: UUID, data: Partial<AMA>) => Promise<boolean>,
      this.getAMAById.bind(this) as (id: UUID) => Promise<AMA | null>,
    );
  }

  // start-ama_(id)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.START_AMA}_${UUID_PATTERN}`, "i"))
  async startAMASession(ctx: Context): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserAccessAMA(fromId))) {
      await ctx.reply("❌ You are not authorized to start AMAs.");
      return;
    }
    const groupIds = {
      public: {
        en: this.config.get<string>("EN_PUBLIC_GROUP_ID")!,
        ar: this.config.get<string>("AR_PUBLIC_GROUP_ID")!,
      },
      admin: this.config.get<string>("ADMIN_GROUP_ID")!,
    };
    await startAMAbyCallback(
      ctx,
      groupIds,
      this.getAMAById.bind(this) as (id: string) => Promise<AMA | null>,
      this.updateAMA.bind(this) as (id: UUID, data: Partial<AMA>) => Promise<boolean>,
    );
  }

  // end-ama_(id)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.END_AMA}_${UUID_PATTERN}`, "i"))
  async endAMASession(ctx: BotContext): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserAccessAMA(fromId))) {
      await ctx.reply("❌ You are not authorized to end AMAs.");
      return;
    }

    await endAMAbyCallback(
      ctx,
      this.getAMAById.bind(this) as (id: string) => Promise<AMA | null>,
      this.getScoresForAMA.bind(this) as (amaId: UUID) => Promise<ScoreWithUser[]>,
      this.winCount.bind(this) as (
        userId: string,
        excludeAmaId?: UUID,
      ) => Promise<{ wins: number }>,
    );
  }

  // select-winners_(id)_(winnerCount)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.SELECT_WINNERS}_${UUID_FRAGMENT}_(\\d+)$`, "i"))
  async selectWinners(ctx: Context): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserSelectWinners(fromId))) {
      await ctx.reply("❌ You are not authorized to select winners.");
      return;
    }

    await selectWinnersCallback(
      ctx,
      this.getAMAById.bind(this) as (id: string) => Promise<AMA | null>,
      this.getScoresForAMA.bind(this) as (id: UUID) => Promise<ScoreWithUser[]>,
    );
  }

  // confirm-winners_(id)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.CONFIRM_WINNERS}_${UUID_PATTERN}`, "i"))
  async confirmWinners(ctx: BotContext): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserSelectWinners(fromId))) {
      await ctx.reply("❌ You are not authorized to select winners.");
      return;
    }
    await confirmWinnersCallback(
      ctx,
      this.getAMAById.bind(this) as (id: UUID) => Promise<AMA | null>,
      this.getScoresForAMA.bind(this) as (id: UUID) => Promise<ScoreWithUser[]>,
      this.addWinner.bind(this) as (
        ama_id: UUID,
        user_id: string,
        message_id: UUID,
        rank: number,
      ) => Promise<WinnerData | null>,
      this.updateAMA.bind(this) as (id: UUID, updates: Partial<AMA>) => Promise<AMA | null>,
      this.deleteWinnersByAMA.bind(this) as (amaId: UUID) => Promise<boolean>,
      this.logger,
    );
  }

  //broadcast-winners_(id)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.BROADCAST_WINNERS}_${UUID_PATTERN}`, "i"))
  async broadcastWinners(ctx: Context): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserBroadcastAnnouncements(fromId))) {
      await ctx.reply("❌ You are not authorized to broadcast announcements.");
      return;
    }
    const groupIds = {
      public: {
        en: this.config.get<string>("EN_PUBLIC_GROUP_ID")!,
        ar: this.config.get<string>("AR_PUBLIC_GROUP_ID")!,
      },
      admin: this.config.get<string>("ADMIN_GROUP_ID")!,
    };
    await handleWinnersBroadcast(
      ctx,
      this.getAMAById.bind(this) as (id: UUID) => Promise<AMA>,
      this.getWinnersWithUserDetails.bind(this) as (amaId: UUID) => Promise<ScoreWithUser[]>,
      groupIds,
      this.getSubscribedUsers.bind(this) as (lang: SupportedLanguage) => Promise<User[]>,
    );
  }

  //discard-user_(username)_(id)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.DISCARD_WINNER}_([a-zA-Z0-9_]+)_(${UUID_PATTERN})`, "i"))
  async handleDiscardUserCallback(ctx: BotContext): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserSelectWinners(fromId))) {
      await ctx.reply("❌ You are not authorized to select winners.");
      return;
    }

    await handleDiscardUser(
      ctx,
      this.getAMAById.bind(this) as (id: UUID) => Promise<AMA | null>,
      this.getScoresForAMA.bind(this) as (id: UUID) => Promise<ScoreWithUser[]>,
      this.winCount.bind(this) as (
        userId: string,
        excludeAmaId?: UUID,
      ) => Promise<{ wins: number }>,
    );
  }

  //reset-winners_(amaId)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.RESET_WINNERS}_${UUID_PATTERN}`, "i"))
  async resetWinners(ctx: BotContext): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserSelectWinners(fromId))) {
      await ctx.reply("❌ You are not authorized to select winners.");
      return;
    }

    await resetWinnersCallback(
      ctx,
      this.getAMAById.bind(this) as (id: UUID) => Promise<AMA | null>,
      this.getScoresForAMA.bind(this) as (amaId: UUID) => Promise<ScoreWithUser[]>,
      this.winCount.bind(this) as (
        userId: string,
        excludeAmaId?: UUID,
      ) => Promise<{ wins: number }>,
    );
  }

  // Handle select-winners-cmd callback
  @Action(new RegExp(`^${CALLBACK_ACTIONS.SELECT_WINNERS_CMD}_${UUID_PATTERN}`, "i"))
  async handleSelectWinnersCmdCallback(ctx: Context): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserSelectWinners(fromId))) {
      await ctx.reply("❌ You are not authorized to select winners.");
      return;
    }

    await selectWinnersByCallback(
      ctx,
      this.getAMAById.bind(this) as (id: string) => Promise<AMA | null>,
      this.getScoresForAMA.bind(this) as (amaId: UUID) => Promise<ScoreWithUser[]>,
      this.getWinnersByAMA.bind(this) as (amaId: UUID) => Promise<WinnerData[]>,
      this.getUserById.bind(this) as (userId: string) => Promise<UserDetails | undefined>,
      this.winCount.bind(this) as (
        userId: string,
        excludeAmaId?: UUID,
      ) => Promise<{ wins: number }>,
    );
  }

  // Handle force-select-winners callback
  @Action(new RegExp(`^${CALLBACK_ACTIONS.FORCE_SELECT_WINNERS}_${UUID_PATTERN}`, "i"))
  async handleForceSelectWinnersCallback(ctx: Context): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserSelectWinners(fromId))) {
      await ctx.reply("❌ You are not authorized to select winners.");
      return;
    }

    await forceSelectWinnersCallback(
      ctx,
      this.getAMAById.bind(this) as (id: string) => Promise<AMA | null>,
      this.getScoresForAMA.bind(this) as (amaId: UUID) => Promise<ScoreWithUser[]>,
      this.winCount.bind(this) as (
        userId: string,
        excludeAmaId?: UUID,
      ) => Promise<{ wins: number }>,
    );
  }

  @Action(new RegExp(`^${CALLBACK_ACTIONS.SCHEDULE_WINNERS_BROADCAST}_${UUID_PATTERN}`, "i"))
  async scheduleWinnersBroadcast(ctx: BotContext): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserBroadcastAnnouncements(fromId))) {
      await ctx.reply("❌ You are not authorized to broadcast announcements.");
      return;
    }

    await broadcastWinnersCallback(
      ctx,
      this.getAMAById.bind(this) as (id: UUID) => Promise<AMA | null>,
    );
  }

  //cancel-winners_(amaId)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.CANCEL_WINNERS}_${UUID_PATTERN}`, "i"))
  async cancelWinners(ctx: BotContext): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserSelectWinners(fromId))) {
      await ctx.reply("❌ You are not authorized to select winners.");
      return;
    }

    await cancelWinnersCallback(
      ctx,
      this.getAMAById.bind(this) as (id: UUID) => Promise<AMA | null>,
    );
  }

  // cancel-ama_(id)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.CANCEL}_${UUID_PATTERN}`, "i"))
  async cancelAMA(ctx: BotContext): Promise<void> {
    await handleNewAMACancel(
      ctx,
      this.deleteAMA.bind(this) as (id: UUID) => Promise<boolean>,
      this.logger,
    );
  }

  // cancel-ama_(id)
  // prettier-ignore
  @Action(new RegExp(`^${CALLBACK_ACTIONS.CANCEL_BROADCAST}_${UUID_PATTERN}`, "i"))
  async cancelBroadcastAMA(ctx: BotContext): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || (!(await this.canUserBroadcastAnnouncements(fromId)) && !(await this.canUserEditAnnouncements(fromId)))) {
      await ctx.reply("❌ You are not authorized to cancel this action.");
      return;
    }
    if (ctx.callbackQuery && "message" in ctx.callbackQuery && ctx.callbackQuery.message) {
      await ctx.deleteMessage(ctx.callbackQuery.message.message_id);
      await ctx.answerCbQuery("Broadcast cancelled successfully.");
    }
  }

  // cancel-edit_(id)
  @Action(new RegExp(`^${CALLBACK_ACTIONS.EDIT_CANCEL}_${UUID_PATTERN}`, "i"))
  async cancelEdit(ctx: BotContext): Promise<void> {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserEditAnnouncements(fromId))) {
      await ctx.answerCbQuery("❌ You are not authorized to edit AMA announcements.", { show_alert: true });
      return;
    }
    await handleCancelEdit(ctx);
  }

  // <<------------------------------------ Text Commands ------------------------------------>>

  @On("text")
  async handleText(ctx: BotContext): Promise<void> {
    // Ignore messages from the bot itself
    if (ctx.from?.is_bot) {
      return;
    }

    const isCommand =
      !!ctx.message &&
      "entities" in ctx.message &&
      Array.isArray(ctx.message.entities) &&
      ctx.message.entities.some((e) => e.type === "bot_command" && e.offset === 0);

    if (isCommand) {
      return;
    }

    const chatID = ctx.chat?.id.toString();

    const groupIds = {
      public: {
        en: this.config.get<string>("EN_PUBLIC_GROUP_ID")!,
        ar: this.config.get<string>("AR_PUBLIC_GROUP_ID")!,
      },
      admin: this.config.get<string>("ADMIN_GROUP_ID")!,
    };

    // prettier-ignore
    if (chatID === groupIds.admin) {
      // Handle scheduling winners broadcast if the context is in the correct state and input matches datetime
      if (
        ctx.session.scheduledWinnersBroadcast?.amaId && ctx.message && "text" in ctx.message &&
        typeof ctx.message.text === "string"
      ) {
        if(!DATETIME_REGEX.test(ctx.message.text)) {
          return void ctx.reply("Please provide a valid date and time in the format YYYY/MM/DD HH:mm");
        }

        await scheduleWinnersBroadcast(
          ctx,
          this.scheduleAMA.bind(this) as (ama_id: UUID, scheduled_time: Date, type: ScheduleType) => Promise<void>,
        );
      } else if (ctx.session.editMode) {
        // Only check edit permissions if user is actually in editing mode
        await this.upsertUserFromContext(ctx);
        const fromId = ctx.from?.id.toString();
        if (!fromId || !(await this.canUserEditAnnouncements(fromId))) {
          await ctx.answerCbQuery("❌ You are not authorized to edit AMA announcements.", { show_alert: true });
        } else {
          await handleEdit(ctx);
        }
      }
      // For regular chat messages in admin group, do nothing (no permission check needed)
    } else if (chatID === groupIds.public.en || chatID === groupIds.public.ar) {
      await handleAMAQuestion(
        ctx, groupIds,
        this.getAMAsByHashtag.bind(this) as (hashtag: string) => Promise<AMA[]>,
        this.storeAMAQuestion.bind(this) as (
          amaId: UUID,
          userId: string,
          question: string,
          chatId: number,
          messageId: number,
          name?: string,
          username?: string,
        ) => Promise<void>,
      );
    } else {
      await ctx.reply("This command is not available in this chat.");
    }
  }

  @On("photo")
  async handleBannerUpload(ctx: BotContext) {
    await this.upsertUserFromContext(ctx);
    const fromId = ctx.from?.id.toString();
    if (!fromId || !(await this.canUserEditAnnouncements(fromId))) {
      await ctx.answerCbQuery("❌ You are not authorized to edit AMA announcements.", { show_alert: true });
      return;
    }

    await handleBannerUpload(
      ctx,
      this.getAMAById.bind(this) as (id: UUID) => Promise<AMA | null>,
      this.updateBanner.bind(this) as (amaId: UUID, file_id: string) => Promise<AMA | null>,
    );
  }
}
