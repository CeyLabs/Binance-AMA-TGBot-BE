import { Injectable, Logger, Inject, forwardRef } from "@nestjs/common";
import { AMAService } from "../ama/ama.service";
import { Context, Telegraf } from "telegraf";
import { InjectBot } from "nestjs-telegraf";
import { UUID } from "crypto";
import { getQuestionAnalysis } from "../ama/helper/openai-utils";
import { CreateScoreData, OpenAIAnalysis } from "../ama/types";
import type { TelegramEmoji } from "telegraf/types";
import { ConfigService } from "@nestjs/config";

interface QueueItem {
  ama_id: UUID;
  user_id: string;
  question: string;
  username?: string;
  name?: string;
  chat_id: number;
  message_id: number;
  tg_msg_id: number;
  topic?: string;
}

interface RetryQueueItem extends QueueItem {
  retries: number;
  nextRetryTime?: Date;
  analysis: OpenAIAnalysis;
}

@Injectable()
export class MessageQueueService {
  private readonly logger = new Logger(MessageQueueService.name);
  private readonly queue: QueueItem[] = [];
  private retryQueue: RetryQueueItem[] = []; // Removed readonly to allow reassignment
  private processing = false;
  private readonly RATE_LIMIT = 5; // Reduced to 5 messages per second to avoid rate limits
  private readonly PROCESS_INTERVAL = 1000; // 1 second
  private readonly MAX_RETRIES = 5; // Maximum number of retry attempts
  private readonly INITIAL_RETRY_DELAY = 2000; // Initial retry delay in milliseconds (2 seconds)

  constructor(
    @Inject(forwardRef(() => AMAService))
    private readonly amaService: AMAService,
    @InjectBot() private readonly bot: Telegraf<Context>,
    private readonly configService: ConfigService,
  ) {
    // Start the queue processing loop
    this.startProcessing();
  }

  async addToQueue(item: QueueItem): Promise<void> {
    // Add item to queue
    this.queue.push(item);
    this.logger.log(`Added item to queue. Current queue length: ${this.queue.length}`);

    // Initial database entry with no analysis data yet
    await this.amaService.addInitialMessage(
      item.ama_id,
      item.user_id,
      item.question,
      item.tg_msg_id,
      item.name,
      item.username,
    );
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    try {
      // Process up to RATE_LIMIT items at once
      const itemsToProcess = this.queue.splice(0, this.RATE_LIMIT);

      this.logger.log(`Processing ${itemsToProcess.length} items from the queue`);

      // Process each item sequentially to better handle rate limits
      for (const item of itemsToProcess) {
        try {
          // Get AI analysis for the question
          const result = await getQuestionAnalysis(item.question, item.topic);

          // Only proceed if we get a valid OpenAIAnalysis object
          if (result && typeof result !== "string") {
            try {
              // Update message with analysis data
              await this.updateMessageWithAnalysis(item, result);
            } catch (error) {
              // Error will be handled in updateMessageWithAnalysis method
              // The method will add to retry queue if it's a rate limiting error
              const errorMessage = error instanceof Error ? error.message : "Unknown error";
              this.logger.error(`Error in updateMessageWithAnalysis: ${errorMessage}`);
              // Continue to next item to avoid stopping the whole batch
              continue;
            }
          } else {
            this.logger.warn(`No valid analysis obtained for message ID ${item.message_id}`);
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          const errorStack = error instanceof Error ? error.stack : "";
          this.logger.error(`Error processing queue item: ${errorMessage}`, errorStack);
        }

        // Add a small delay between items to avoid hitting rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } finally {
      this.processing = false;
    }
  }

  private async updateMessageWithAnalysis(
    item: QueueItem,
    analysis: OpenAIAnalysis,
    isRetry: boolean = false,
  ): Promise<void> {
    try {
      // Get the admin group ID from config
      const adminGroupId = this.configService.get<string>("ADMIN_GROUP_ID");
      if (!adminGroupId) {
        this.logger.error("Admin group ID not found in config");
        return;
      }

      // Create analytics message
      const analysisMessage =
        `<b>📊 AI Analysis</b>\n\n` +
        `<b>✨ Originality:</b> ${analysis.originality?.score}/10\n` +
        `<i>${analysis.originality?.comment}</i>\n\n` +
        `<b>🎯 Relevance:</b> ${analysis.relevance?.score}/10\n` +
        `<i>${analysis.relevance?.comment}</i>\n\n` +
        `<b>🔍 Clarity:</b> ${analysis.clarity?.score}/10\n` +
        `<i>${analysis.clarity?.comment}</i>\n\n` +
        `<b>📢 Engagement:</b> ${analysis.engagement?.score}/10\n` +
        `<i>${analysis.engagement?.comment}</i>\n\n` +
        `<b>✍️ Language:</b> ${analysis.language?.score}/10\n` +
        `<i>${analysis.language?.comment}</i>\n\n` +
        `<b>🏁 Total Score:</b> <b>${analysis.total_score}/50</b>`;

      // Only update the DB if this is not a retry (to avoid duplicate updates)
      if (!isRetry) {
        // Update the message in the database with analysis data
        const scoreData: CreateScoreData = {
          ama_id: item.ama_id,
          user_id: item.user_id,
          question: item.question,
          originality: analysis.originality?.score || 0,
          relevance: analysis.relevance?.score || 0,
          clarity: analysis.clarity?.score || 0,
          engagement: analysis.engagement?.score || 0,
          language: analysis.language?.score || 0,
          score: analysis.total_score || 0,
        };

        // Update the message in the database with the analysis data
        await this.amaService.updateMessageAnalysis(item.tg_msg_id, scoreData);
      }

      // Steps that might trigger rate limiting - will retry if they fail
      // Get the forwarded message ID from the AMA service
      const forwardedMessageData = await this.amaService.getForwardedMessageId(item.tg_msg_id);

      if (forwardedMessageData && forwardedMessageData.forwarded_msg_id) {
        // Send the analysis message to the admin group
        await this.bot.telegram.sendMessage(adminGroupId, analysisMessage, {
          reply_parameters: {
            message_id: forwardedMessageData.forwarded_msg_id,
          },
          parse_mode: "HTML",
        });
        this.logger.log(`Successfully sent analysis message for message ID ${item.message_id}`);

        // Add heart reaction to the message after analytics are processed
        await this.bot.telegram.callApi("setMessageReaction", {
          chat_id: item.chat_id,
          message_id: item.message_id,
          reaction: [{ type: "emoji", emoji: "❤️" as TelegramEmoji }],
        });
      } else {
        this.logger.warn(`No forwarded message found for original message ID ${item.tg_msg_id}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : "";
      this.logger.error(`Error updating message with analysis: ${errorMessage}`, errorStack);

      // If it's a rate limiting error, add to retry queue
      if (errorMessage.includes("Too Many Requests") && !isRetry) {
        this.addToRetryQueue(item, analysis, error);
      }

      // Re-throw the error so the calling code can handle it appropriately
      throw error;
    }
  }

  // Helper method to add item to retry queue with exponential backoff
  private addToRetryQueue(item: QueueItem, analysis: OpenAIAnalysis, error: unknown): void {
    // Parse retry-after value from error if it exists
    let retryAfterSeconds = 1;

    // Extract retry-after from error message (e.g., "429: Too Many Requests: retry after 11")
    if (error instanceof Error) {
      const errorMessage = error.message;
      const match = errorMessage.match(/retry after (\d+)/i);
      if (match && match[1]) {
        retryAfterSeconds = parseInt(match[1], 10);
      }
    }

    // Find existing item in retry queue
    const existingIndex = this.retryQueue.findIndex(
      (retryItem) => retryItem.tg_msg_id === item.tg_msg_id,
    );

    if (existingIndex >= 0) {
      // Update existing item in retry queue
      const existingItem = this.retryQueue[existingIndex];
      const retries = existingItem.retries + 1;

      // Calculate next retry time with exponential backoff
      const nextRetryDelay = Math.min(
        this.INITIAL_RETRY_DELAY * Math.pow(2, retries) * retryAfterSeconds,
        60000, // Cap at 1 minute
      );

      this.retryQueue[existingIndex] = {
        ...existingItem,
        retries,
        nextRetryTime: new Date(Date.now() + nextRetryDelay),
      };

      this.logger.log(
        `Scheduled retry #${retries} for message ID ${item.message_id} after ${nextRetryDelay}ms`,
      );
    } else {
      // Add new item to retry queue
      const nextRetryDelay = this.INITIAL_RETRY_DELAY * retryAfterSeconds;
      const retryItem: RetryQueueItem = {
        ...item,
        retries: 1,
        nextRetryTime: new Date(Date.now() + nextRetryDelay),
        analysis,
      };

      this.retryQueue.push(retryItem);
      this.logger.log(
        `Added message ID ${item.message_id} to retry queue. Will retry after ${nextRetryDelay}ms`,
      );
    }
  }

  // Process items in the retry queue
  private async processRetryQueue(): Promise<void> {
    if (this.retryQueue.length === 0) return;

    const now = new Date();
    const itemsToRetry: RetryQueueItem[] = [];
    const remainingItems: RetryQueueItem[] = [];

    // Split items into those ready to retry and those still waiting
    this.retryQueue.forEach((item) => {
      if (item.nextRetryTime && item.nextRetryTime <= now) {
        if (item.retries <= this.MAX_RETRIES) {
          itemsToRetry.push(item);
        } else {
          this.logger.warn(
            `Max retries (${this.MAX_RETRIES}) exceeded for message ID ${item.message_id}. Dropping item.`,
          );
        }
      } else {
        remainingItems.push(item);
      }
    });

    // Update retry queue with only remaining items
    this.retryQueue = remainingItems;

    // Process items that are ready for retry
    for (const item of itemsToRetry) {
      try {
        this.logger.log(`Retrying message ID ${item.message_id} (attempt #${item.retries})`);
        await this.updateMessageWithAnalysis(item, item.analysis, true);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        this.logger.error(`Retry failed for message ID ${item.message_id}: ${errorMessage}`);

        // If it's a rate limiting error, add it back to retry queue
        if (errorMessage.includes("Too Many Requests")) {
          this.addToRetryQueue(item, item.analysis, error);
        }
      }
    }
  }

  private startProcessing(): void {
    // Process main queue at regular intervals
    setInterval(() => {
      void this.processQueue();
    }, this.PROCESS_INTERVAL);

    // Process retry queue every 2 seconds
    setInterval(() => {
      void this.processRetryQueue();
    }, 2000);
  }

  // For debugging and monitoring
  getQueueLength(): number {
    return this.queue.length + this.retryQueue.length;
  }
}
