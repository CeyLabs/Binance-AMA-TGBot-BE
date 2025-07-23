import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { Telegraf, Context } from "telegraf";
import { InjectBot } from "nestjs-telegraf";
import { AMAService } from "../ama/ama.service";
import { MessageWithAma } from "../ama/types";
import { getQuestionAnalysis } from "../ama/helper/openai-utils";
import { formatAnalysisMessage, handleTelegramError } from "../ama/helper/message-processor-utils";
import { OpenAIAnalysis } from "../ama/types";
import { TelegramEmoji } from "telegraf/types";
import { buildAMAMessage, initImageUrl } from "../ama/new-ama/helper/msg-builder";
import { buildWinnersMessage, congratsImg } from "../ama/end-ama/helper/utils";
import { HIDDEN_KEYS } from "../ama/ama.constants";

/**
 * SchedulerService - Handles AMA message processing and scheduled broadcasts
 *
 * Key Components:
 * --------------
 * Message Processing
 *    - Fetches up to 20 unprocessed messages per batch
 *    - Processes in chunks of 2 concurrent messages
 *    - Each message involves:
 *      ➜ AI analysis of question content
 *      ➜ Forwarding to admin group
 *      ➜ Adding reactions and analysis results
 *
 * Rate Limiting:
 * -------------
 * - Concurrent processing: 2 messages at a time
 * - Chunk delay: max(500ms, messages * 100ms)
 * - Exponential backoff on rate limits
 * - Retries: Up to 5 attempts per chunk
 *
 * Error Handling:
 * --------------
 * - Independent error handling per operation
 * - Graceful degradation (continues despite non-critical failures)
 * - Rate limit detection and automatic retries
 * - Detailed error logging and admin notifications
 *
 * Performance:
 * -----------
 * - Processing capacity: ~40 messages/minute
 * - Average latency: 2-3 seconds per message
 * - Safe operation at 100 messages/second input rate
 */

@Injectable()
export class SchedulerService {
  private readonly ADMIN_GROUP_ID: string;
  private isProcessingMessages = false;
  private readonly BATCH_SIZE = 20; // Number of messages to process in each batch
  private readonly CONCURRENT_LIMIT = 2; // Maximum number of messages to process concurrently (2 is tested without issues on 100msg/s, 3 is somewhat unstable)
  private readonly CHUNK_DELAY = 500; // Minimum delay between processing chunks (in milliseconds)
  private readonly logger = new Logger(SchedulerService.name);

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
        await this.processChunkWithRateLimit(chunk);
        const delayMs = Math.max(this.CHUNK_DELAY, chunk.length * 100);
        await this.delay(delayMs);
      }
    } catch (error) {
      this.logger.error(`Error processing messages: ${error}`);
    } finally {
      this.isProcessingMessages = false;
    }
  }

  private async processChunkWithRateLimit(chunk: MessageWithAma[]) {
    let attempts = 0;
    const maxAttempts = 5;
    let delay = 500; // Initial delay before retrying if rate-limited

    while (attempts < maxAttempts) {
      try {
        const results = await Promise.allSettled(
          chunk.map((message) => this.processMessage(message)),
        );

        results.forEach((result, index) => {
          if (result.status === "rejected") {
            this.logger.error(`Failed to process message ${chunk[index].id}: ${result.reason}`);
          }
        });
        return; // Successfully processed, exit loop
      } catch (error) {
        const isRateLimited = this.isRateLimitedError(error);
        if (isRateLimited) {
          this.logger.warn(`Rate limit hit, retrying after delay (${delay}ms)`);
          await this.delay(delay);
          delay = Math.min(10000, delay * 2); // Exponential backoff
          attempts++;
        } else {
          throw error; // Other errors, do not retry
        }
      }
    }
  }

  private async processMessage(message: MessageWithAma) {
    try {
      // First forward message to admin
      const forwardedMsgId = await this.forwardMessageToAdmin(message);

      // Check for duplicates
      const isDuplicate = await this.amaService.checkDuplicateQuestion(
        message.ama_id,
        message.question,
      );

      this.logger.log(
        `Message ${message.id} duplicate check: ${isDuplicate ? "DUPLICATE" : "UNIQUE"}`,
      );

      if (isDuplicate) {
        this.logger.log(`Handling duplicate message ${message.id}`);

        try {
          // For duplicates: set scores to 0 and mark as processed
          await this.amaService.updateMessageWithAnalysis(message.id, {
            originality: 0,
            clarity: 0,
            engagement: 0,
            score: 0,
            processed: true,
          });
          this.logger.log(`Set zero scores for duplicate message ${message.id}`);

          // Add poop reaction
          await this.bot.telegram.callApi("setMessageReaction", {
            chat_id: message.chat_id,
            message_id: message.tg_msg_id,
            reaction: [{ type: "emoji", emoji: "🙏" as TelegramEmoji }],
          });
          this.logger.log(`Added 🙏 reaction to duplicate message ${message.id}`);

          // Notify admin if we have the forwarded message ID
          await this.bot.telegram.sendMessage(
            this.ADMIN_GROUP_ID,
            "⚠️ Duplicate question detected! Scores set to 0.",
            {
              reply_parameters: {
                message_id: forwardedMsgId,
              },
            },
          );

          this.logger.log(`Successfully processed duplicate message ${message.id}`);
          return; // Important: stop processing here for duplicates
        } catch (error) {
          this.logger.error(`Error processing duplicate message ${message.id}: ${error}`);
          // If failed delete the forwarded message
          await this.bot.telegram
            .deleteMessage(this.ADMIN_GROUP_ID, forwardedMsgId)
            .catch((deleteError) => {
              this.logger.error(
                `Failed to delete forwarded message ${forwardedMsgId} for duplicate ${message.id}: ${deleteError}`,
              );
            });
          // Still return to prevent further processing
          return;
        }
      }

      this.logger.log(`Processing unique message ${message.id} with AI analysis`);

      // Run AI analysis in parallel with message forwarding
      const analysisResult = await getQuestionAnalysis(message.question, message.topic);

      // Only proceed if we get a valid OpenAIAnalysis object
      if (!analysisResult || typeof analysisResult === "string") {
        this.logger.error(`Analysis failed for message ${message.id}`);
        await this.handleAnalysisFailure(message);
        return;
      }

      const analysis = analysisResult;

      // Save analysis results
      await this.amaService.updateMessageWithAnalysis(message.id, {
        originality: analysis.originality?.score || 0,
        clarity: analysis.clarity?.score || 0,
        engagement: analysis.engagement?.score || 0,
        score: analysis.total_score || 0,
        processed: true,
      });

      // Try to send analysis and add reaction, if analysis sending fails, delete forwarded message
      try {
        await Promise.all([
          // Update message with analysis scores
          this.amaService.updateMessageWithAnalysis(message.id, {
            originality: analysis.originality?.score || 0,
            clarity: analysis.clarity?.score || 0,
            engagement: analysis.engagement?.score || 0,
            score: analysis.total_score || 0,
            processed: true,
          }),

          this.sendAnalysisToAdmin(forwardedMsgId, analysis),

          this.addHeartReaction(message),
        ]);
        this.logger.log(`Successfully processed unique message ${message.id}`);
      } catch (error) {
        this.logger.error(`Error sending analysis for message ${message.id}: ${error}`);
        // Delete the forwarded message if sending analysis failed
        await this.bot.telegram
          .deleteMessage(this.ADMIN_GROUP_ID, forwardedMsgId)
          .catch((deleteError) => {
            this.logger.error(
              `Failed to delete forwarded message ${forwardedMsgId} after analysis send failure for message ${message.id}: ${deleteError}`,
            );
          });
      }
    } catch (error) {
      this.logger.error(`Error processing message ${message.id}: ${error}`);
    }
  }

  private async forwardMessageToAdmin(message: MessageWithAma): Promise<number> {
    try {
      const forwardedMsg = await this.bot.telegram.forwardMessage(
        this.ADMIN_GROUP_ID,
        message.chat_id,
        message.tg_msg_id,
        {
          message_thread_id: message.thread_id,
        },
      );

      this.logger.log(`Forwarded message ${message.id} to admin group`);
      return forwardedMsg.message_id;
    } catch (error) {
      const result = handleTelegramError(error, "forwarding message", message.id);
      if (result.shouldRetry) {
        throw error; // Let the main handler deal with retry logic
      }
      throw error;
    }
  }

  private async sendAnalysisToAdmin(
    forwardedMsgId: number,
    analysis: OpenAIAnalysis,
  ): Promise<void> {
    try {
      const analysisMessage = formatAnalysisMessage(analysis);
      await this.bot.telegram.sendMessage(this.ADMIN_GROUP_ID, analysisMessage, {
        reply_parameters: {
          message_id: forwardedMsgId,
        },
        parse_mode: "HTML",
      });
    } catch (error) {
      const result = handleTelegramError(error, "sending analysis", String(forwardedMsgId));
      if (!result.shouldRetry) {
        this.logger.warn(
          `Failed to send analysis for message with forwarded ID ${forwardedMsgId}, but continuing since scores are saved`,
        );
      }
    }
  }

  private async addHeartReaction(message: MessageWithAma): Promise<void> {
    try {
      await this.bot.telegram.callApi("setMessageReaction", {
        chat_id: message.chat_id,
        message_id: message.tg_msg_id,
        reaction: [{ type: "emoji", emoji: "🙏" as TelegramEmoji }],
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

    try {
      const forwardedId = await this.forwardMessageToAdmin(message);
      await this.bot.telegram.sendMessage(
        this.ADMIN_GROUP_ID,
        "⚠️ Analysis failed. Please try again later.",
        {
          reply_parameters: {
            message_id: forwardedId,
          },
        },
      );
    } catch (replyError) {
      handleTelegramError(replyError, "sending error notification", message.id);
    }
  }

  // Helper method to check for rate-limited error
  private isRateLimitedError(error: unknown): boolean {
    // Add logic to check if the error is related to rate limiting (e.g., HTTP 429)
    if (!error || typeof error !== "object") return false;

    const errorObj = error as Record<string, unknown>;
    if (!("response" in errorObj)) return false;

    const response = errorObj.response;
    if (!response || typeof response !== "object") return false;

    return (response as Record<string, unknown>).status === 429;
  }

  // Helper method for delay
  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Run every minute to broadcast scheduled AMAs
  @Cron("*/1 * * * *")
  async broadcastScheduledAMAs() {
    this.logger.log(`[Cron] Checking for scheduled AMAs to broadcast...`);

    const scheduledItems = await this.amaService.getDueScheduledTimes();
    if (scheduledItems.length === 0) {
      return;
    }

    const publicGroupIds = {
      en: this.config.get<string>("EN_PUBLIC_GROUP_ID")!,
      ar: this.config.get<string>("AR_PUBLIC_GROUP_ID")!,
    };
    const adminGroupId = this.config.get<string>("ADMIN_GROUP_ID")!;
    const adminTopicId = process.env.ADMIN_TOPIC_ID;

    for (const { scheduleId, amaId, type } of scheduledItems) {
      let broadcastSuccessful = false;
      try {
        const ama = await this.amaService.getAMAById(amaId);
        if (!ama) {
          this.logger.warn(`AMA with ID ${amaId} not found`);
          continue;
        }

        let message = "";
        let image = "";

        if (type === "init") {
          image = ama.banner_file_id || initImageUrl[ama.language];
          message = buildAMAMessage(ama);
          this.logger.log(`Broadcasting initial AMA #${ama.session_no} with ID ${amaId}`);
        } else if (type === "winner") {
          image = congratsImg;
          const winners = await this.amaService.getWinnersWithUserDetails(amaId);
          message = buildWinnersMessage(ama, winners, false);
        }

        const groupId = ama.language === "ar" ? publicGroupIds.ar : publicGroupIds.en;

        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (!image) {
          this.logger.error(`No image found for AMA #${ama.session_no} with ID ${amaId}`);
          continue;
        }

        const reminderUrl = `https://t.me/${this.config.get<string>("BOT_USERNAME")}?start=${
          ama.language === "ar" ? HIDDEN_KEYS.SUBSCRIBE_AR : HIDDEN_KEYS.SUBSCRIBE_EN
        }`;
        const inlineKeyboard =
          type === "init"
            ? ama.language === "ar"
              ? [
                  [{ text: "املأ الاستمارة 👉", url: ama.form_link }],
                  [{ text: "قم بتعيين تذكير ⏰", url: reminderUrl }],
                ]
              : [
                  [{ text: "👉 Submit the form", url: ama.form_link }],
                  [{ text: "⏰ Set a reminder", url: reminderUrl }],
                ]
            : ama.language === "ar"
              ? [[{ text: "قم بتعيين تذكير للمحاثة القادمة ⏰", url: reminderUrl }]]
              : [[{ text: "⏰ Set a reminder for the next AMA", url: reminderUrl }]];

        const sent = await this.bot.telegram.sendPhoto(groupId, image, {
          caption: message,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: inlineKeyboard },
        });

        await this.bot.telegram.pinChatMessage(groupId, sent.message_id);

        // Send to subscribed users
        const subscribers = await this.amaService.getSubscribedUsers(ama.language);
        for (const user of subscribers) {
          try {
            await this.bot.telegram.sendPhoto(user.user_id, image, {
              caption: message,
              parse_mode: "HTML",
            });
          } catch (err) {
            this.logger.warn(`Failed to DM announcement to ${user.user_id}: ${err}`);
          }
          await this.delay(200);
        }

        // Mark as successful after main broadcast
        broadcastSuccessful = true;

        // Try to send admin notification (If topic ID is 1, it's general chat)
        try {
          const messageThreadId =
            adminTopicId && adminTopicId !== "1" ? parseInt(adminTopicId) : undefined;

          await this.bot.telegram.sendMessage(
            adminGroupId,
            `Scheduled broadcast for AMA #${ama.session_no} ${type} was successful!`,
            { message_thread_id: messageThreadId },
          );
        } catch (adminError) {
          console.error(`Failed to send admin notification for AMA ${amaId}:`, adminError);
        }

        // Delete the scheduled time since the main broadcast was successful
        if (broadcastSuccessful) {
          try {
            await this.amaService.deleteScheduledTime(scheduleId);
            this.logger.log(`Scheduled time ${scheduleId} deleted successfully`);
          } catch (deleteError) {
            this.logger.error(`Failed to delete scheduled time ${scheduleId}:`, deleteError);
          }
        }
      } catch (error) {
        this.logger.error(`Failed to broadcast AMA with ID ${amaId}:`, error);
      }
    }
  }
}
