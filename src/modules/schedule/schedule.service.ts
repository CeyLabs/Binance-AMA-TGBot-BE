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
import { TelegramEmoji } from "telegraf/types";

@Injectable()
export class SchedulerService {
  private readonly ADMIN_GROUP_ID: string;
  private isProcessingMessages = false;
  private readonly BATCH_SIZE = 20; // Number of messages to process in each batch
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
    // Prevent overlapping executions
    if (this.isProcessingMessages) {
      return;
    }

    try {
      this.isProcessingMessages = true;

      // Get unprocessed messages using AMA service
      const unprocessedMessages = await this.amaService.getUnprocessedMessages(this.BATCH_SIZE);

      if (unprocessedMessages.length === 0) {
        return;
      }

      this.logger.log(`Processing ${unprocessedMessages.length} messages...`);

      // Process each message sequentially to avoid rate limits
      for (const message of unprocessedMessages) {
        await this.processMessage(message);

        // Add longer delay between messages to prevent rate limiting
        // Telegram's rate limits are around 30 messages per second, but we're doing multiple operations per message
        await new Promise((resolve) => setTimeout(resolve, 500));
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
      // 1. Forward the message to admin group if not already forwarded
      if (!message.forwarded_msg_id) {
        try {
          const forwardedMsg = await this.bot.telegram.forwardMessage(
            this.ADMIN_GROUP_ID,
            message.chat_id,
            message.tg_msg_id,
            {
              message_thread_id: message.thread_id,
            },
          );

          // Update message with forwarded_msg_id
          await this.amaService.updateMessageForwardedId(message.id, forwardedMsg.message_id);

          message.forwarded_msg_id = forwardedMsg.message_id;

          this.logger.log(`Forwarded message ${message.id} to admin group`);

          // Add a small delay to avoid rate limiting for the next API call
          await new Promise((resolve) => setTimeout(resolve, 300));
        } catch (error) {
          const result = handleTelegramError(error, "forwarding message", message.id);
          if (result.shouldRetry) {
            // Mark for retry later by keeping processed=false
            // The message will be picked up again in the next batch
            return;
          }
        }
      }

      // 2. Get AI analysis
      const analysisResult = await getQuestionAnalysis(message.question, message.topic);

      // Only proceed if we get a valid OpenAIAnalysis object
      if (!analysisResult || typeof analysisResult === "string") {
        this.logger.error(`Analysis failed for message ${message.id}`);

        // Mark as processed to avoid endless retries but with failure flag
        await this.amaService.markMessageAsProcessed(message.id);

        // Try to send error message to admin
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
        return;
      }

      const analysis = analysisResult;

      // 3. Update message with analysis scores
      await this.amaService.updateMessageWithAnalysis(message.id, {
        originality: analysis.originality?.score || 0,
        relevance: analysis.relevance?.score || 0,
        clarity: analysis.clarity?.score || 0,
        engagement: analysis.engagement?.score || 0,
        language: analysis.language?.score || 0,
        score: analysis.total_score || 0,
        processed: true,
      });

      // 4. Send analysis message to admin group
      if (message.forwarded_msg_id) {
        try {
          const analysisMessage = formatAnalysisMessage(analysis);

          await this.bot.telegram.sendMessage(this.ADMIN_GROUP_ID, analysisMessage, {
            reply_parameters: {
              message_id: message.forwarded_msg_id,
            },
            parse_mode: "HTML",
          });
        } catch (error) {
          const result = handleTelegramError(error, "sending analysis", message.id);

          if (result.shouldRetry) {
            this.logger.warn(
              `Rate limited when sending analysis for message ${message.id}. ` +
                `Retry after ${result.retryAfter}s. Will mark as processed anyway since scores are saved to DB.`,
            );
          }
        }
      }

      // 5. Add heart reaction to original message
      try {
        await this.bot.telegram.callApi("setMessageReaction", {
          chat_id: message.chat_id,
          message_id: message.tg_msg_id,
          reaction: [{ type: "emoji", emoji: "❤️" as TelegramEmoji }],
        });
      } catch (error) {
        const result = handleTelegramError(error, "setting reaction", message.id);

        if (result.shouldRetry) {
          this.logger.warn(
            `Rate limited when setting reaction to message ${message.id}. Retry after ${result.retryAfter}s. ` +
              `Will continue processing without reaction.`,
          );
        }
      }

      this.logger.log(`Successfully processed message ${message.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : "";
      this.logger.error(`Error processing message ${message.id}: ${errorMessage}`, errorStack);
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
