import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { buildAMAMessage, imageUrl } from "../ama/new-ama/helper/msg-builder";
import { Telegraf, Context } from "telegraf";
import { InjectBot } from "nestjs-telegraf";
import { AMAService } from "../ama/ama.service";
import { getQuestionAnalysis } from "../ama/helper/openai-utils";
import { formatAnalysisMessage, handleTelegramError } from "../ama/helper/message-processor-utils";
import { MessageWithAma } from "../ama/types";
import { OpenAIAnalysis } from "../ama/types";
import { TelegramEmoji } from "telegraf/types";

/**
 * The SchedulerService handles two main tasks:
 * 1. Processing AMA messages with AI analysis
 * 2. Broadcasting scheduled AMAs
 *
 * Message Processing Flow:
 * - Runs every second via Cron
 * - Fetches up to 20 unprocessed messages (BATCH_SIZE)
 * - Uses concurrent processing with rate limiting:
 *   - Splits messages into chunks of 5 (CONCURRENT_LIMIT)
 *   - Each chunk is processed in parallel using Promise.allSettled
 *   - Adaptive delay between chunks (max(500ms, chunkSize * 100ms))
 *
 * For each message:
 * 1. Parallel operations:
 *    - Forward message to admin group
 *    - Get AI analysis of the question
 * 2. If analysis succeeds:
 *    - Update DB with analysis scores
 *    - Send analysis to admin group (if forwarded)
 *    - Add heart reaction to original message
 * 3. If analysis fails:
 *    - Mark message as processed
 *    - Send failure notification to admin group
 *
 * Error Handling:
 * - Independent error handling for each operation
 * - Non-critical failures (reactions, notifications) don't block processing
 * - Failed messages remain for retry in next batch
 * - Uses Promise.allSettled to continue despite individual failures
 *
 * Rate Limiting Strategy:
 * - Maximum 5 concurrent messages per chunk
 * - Adaptive delay between chunks (500ms minimum)
 * - Respects Telegram's rate limits (~30 messages/second)
 * - Each message involves 3 API calls (forward, analysis, reaction)
 *
 * Performance Characteristics:
 * - Processes up to 20 messages per batch
 * - Average processing time: 1-2 seconds per batch
 * - Automatic retry for rate-limited operations
 * - Parallel operations optimize throughput
 */

@Injectable()
export class SchedulerService {
  private readonly ADMIN_GROUP_ID: string;
  private isProcessingMessages = false;
  private readonly BATCH_SIZE = 20; // Number of messages to process in each batch
  private readonly logger = new Logger(SchedulerService.name);
  private readonly CONCURRENT_LIMIT = 3; // Maximum number of messages to process concurrently
  private readonly CHUNK_DELAY = 500; // Minimum delay between processing chunks (in milliseconds)

  constructor(
    private readonly config: ConfigService,
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly amaService: AMAService,
  ) {
    this.ADMIN_GROUP_ID = this.config.get<string>("ADMIN_GROUP_ID")!;
    if (!this.ADMIN_GROUP_ID) {
      this.logger.error("ADMIN_GROUP_ID not found in config");
    }
  }

  // Run every second to process unprocessed messages
  @Cron("*/1 * * * * *")
  async processUnprocessedMessages() {
    if (this.isProcessingMessages) {
      return;
    }

    try {
      this.isProcessingMessages = true;

      const unprocessedMessages = await this.amaService.getUnprocessedMessages(this.BATCH_SIZE);

      if (unprocessedMessages.length === 0) {
        return;
      }

      this.logger.log(`Processing ${unprocessedMessages.length} messages...`);

      // Process messages in parallel with a concurrency limit
      const chunks: MessageWithAma[][] = [];

      for (let i = 0; i < unprocessedMessages.length; i += this.CONCURRENT_LIMIT) {
        chunks.push(unprocessedMessages.slice(i, i + this.CONCURRENT_LIMIT));
      }

      for (const chunk of chunks) {
        // Process each chunk with better error handling
        const results = await Promise.allSettled(
          chunk.map((message) => this.processMessage(message)),
        );

        // Log failed messages for retry
        results.forEach((result, index) => {
          if (result.status === "rejected") {
            this.logger.error(`Failed to process message ${chunk[index].id}: ${result.reason}`);
          }
        });

        // Adaptive delay based on chunk size
        const delayMs = Math.max(this.CHUNK_DELAY, chunk.length * 100);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : "";
      this.logger.error(`Error processing messages: ${errorMessage}`, errorStack);
    } finally {
      this.isProcessingMessages = false;
    }
  }

  private async processMessage(message: MessageWithAma) {
    try {
      // Run AI analysis in parallel with message forwarding
      const [analysisResult] = await Promise.all([
        getQuestionAnalysis(message.question, message.topic),
        this.forwardMessageToAdmin(message),
      ]);

      // Only proceed if we get a valid OpenAIAnalysis object
      if (!analysisResult || typeof analysisResult === "string") {
        this.logger.error(`Analysis failed for message ${message.id}`);
        await this.handleAnalysisFailure(message);
        return;
      }

      const analysis = analysisResult;

      // Update DB and send notifications in parallel
      await Promise.all([
        // Update message with analysis scores
        this.amaService.updateMessageWithAnalysis(message.id, {
          originality: analysis.originality?.score || 0,
          relevance: analysis.relevance?.score || 0,
          clarity: analysis.clarity?.score || 0,
          engagement: analysis.engagement?.score || 0,
          language: analysis.language?.score || 0,
          score: analysis.total_score || 0,
          processed: true,
        }),
        // Send analysis message if we have a forwarded message
        message.forwarded_msg_id ? this.sendAnalysisToAdmin(message, analysis) : Promise.resolve(),
        // Add heart reaction
        this.addHeartReaction(message),
      ]);

      this.logger.log(`Successfully processed message ${message.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : "";
      this.logger.error(`Error processing message ${message.id}: ${errorMessage}`, errorStack);
    }
  }

  private async forwardMessageToAdmin(message: MessageWithAma): Promise<void> {
    if (message.forwarded_msg_id) return;

    try {
      const forwardedMsg = await this.bot.telegram.forwardMessage(
        this.ADMIN_GROUP_ID,
        message.chat_id,
        message.tg_msg_id,
        {
          message_thread_id: message.thread_id,
        },
      );

      await this.amaService.updateMessageForwardedId(message.id, forwardedMsg.message_id);
      message.forwarded_msg_id = forwardedMsg.message_id;
      this.logger.log(`Forwarded message ${message.id} to admin group`);
    } catch (error) {
      const result = handleTelegramError(error, "forwarding message", message.id);
      if (result.shouldRetry) {
        throw error; // Let the main handler deal with retry logic
      }
    }
  }

  private async sendAnalysisToAdmin(
    message: MessageWithAma,
    analysis: OpenAIAnalysis,
  ): Promise<void> {
    try {
      const analysisMessage = formatAnalysisMessage(analysis);
      await this.bot.telegram.sendMessage(this.ADMIN_GROUP_ID, analysisMessage, {
        reply_parameters: {
          message_id: message.forwarded_msg_id!,
        },
        parse_mode: "HTML",
      });
    } catch (error) {
      const result = handleTelegramError(error, "sending analysis", message.id);
      if (!result.shouldRetry) {
        this.logger.warn(
          `Failed to send analysis for message ${message.id}, but continuing since scores are saved`,
        );
      }
    }
  }

  private async addHeartReaction(message: MessageWithAma): Promise<void> {
    try {
      await this.bot.telegram.callApi("setMessageReaction", {
        chat_id: message.chat_id,
        message_id: message.tg_msg_id,
        reaction: [{ type: "emoji", emoji: "❤️" as TelegramEmoji }],
      });
    } catch (error) {
      const result = handleTelegramError(error, "setting reaction", message.id);
      if (!result.shouldRetry) {
        this.logger.warn(`Failed to set reaction for message ${message.id}, but continuing`);
      }
    }
  }

  private async handleAnalysisFailure(message: MessageWithAma): Promise<void> {
    await this.amaService.markMessageAsProcessed(message.id);

    if (message.forwarded_msg_id) {
      try {
        await this.bot.telegram.sendMessage(
          this.ADMIN_GROUP_ID,
          "⚠️ Analysis failed. Please try again later.",
          {
            reply_parameters: {
              message_id: message.forwarded_msg_id,
            },
          },
        );
      } catch (replyError) {
        handleTelegramError(replyError, "sending error notification", message.id);
      }
    }
  }

  // Run every minute to broadcast scheduled AMAs
  @Cron("*/1 * * * *")
  async broadcastScheduledAMAs() {
    const now = new Date();
    console.log(`[${now.toISOString()}] Checking for scheduled AMAs...`);

    const scheduledItems = await this.amaService.getDueScheduledTimes(now);
    if (scheduledItems.length === 0) {
      return;
    }

    const publicGroupIds = {
      en: this.config.get<string>("EN_PUBLIC_GROUP_ID")!,
      ar: this.config.get<string>("AR_PUBLIC_GROUP_ID")!,
    };
    const adminGroupId = this.config.get<string>("ADMIN_GROUP_ID")!;
    const adminTopicId = process.env.ADMIN_TOPIC_ID;

    for (const { scheduleId, amaId } of scheduledItems) {
      let broadcastSuccessful = false;
      try {
        const ama = await this.amaService.getAMAById(amaId);
        if (!ama) {
          console.warn(`AMA with ID ${amaId} not found`);
          continue;
        }

        const message = buildAMAMessage(ama);
        const groupId = ama.language === "ar" ? publicGroupIds.ar : publicGroupIds.en;

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const sent = await this.bot.telegram.sendPhoto(groupId, imageUrl, {
          caption: message,
          parse_mode: "HTML",
        });

        await this.bot.telegram.pinChatMessage(groupId, sent.message_id);

        // Mark as successful after main broadcast
        broadcastSuccessful = true;

        // Try to send admin notification (If topic ID is 1, it's genral chat)
        try {
          const messageThreadId =
            adminTopicId && adminTopicId !== "1" ? parseInt(adminTopicId) : undefined;

          await this.bot.telegram.sendMessage(
            adminGroupId,
            `✅ AMA session #${ama.session_no} has been broadcasted.`,
            { message_thread_id: messageThreadId },
          );
        } catch (adminError) {
          console.error(`Failed to send admin notification for AMA ${amaId}:`, adminError);
        }

        // Delete the scheduled time since the main broadcast was successful
        if (broadcastSuccessful) {
          try {
            await this.amaService.deleteScheduledTime(scheduleId);
            console.log(`Scheduled time ${scheduleId} deleted successfully`);
          } catch (deleteError) {
            console.error(`Failed to delete scheduled time ${scheduleId}:`, deleteError);
          }
        }
      } catch (error) {
        console.error(`Failed to broadcast AMA with ID ${amaId}:`, error);
      }
    }
  }
}
