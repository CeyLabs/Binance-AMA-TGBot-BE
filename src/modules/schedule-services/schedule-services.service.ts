import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { buildAMAMessage, imageUrl } from "../ama/new-ama/helper/msg-builder";
import { Telegraf } from "telegraf";
import { InjectBot } from "nestjs-telegraf";
import { AMAService } from "../ama/ama.service";

@Injectable()
export class SchedulerService {
  constructor(
    private readonly config: ConfigService,
    @InjectBot() private readonly bot: Telegraf,
    private readonly amaService: AMAService
  ) {}

  @Cron("*/1 * * * *") // every minute
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

    for (const { scheduleId, amaId } of scheduledItems) {
      try {
        const ama = await this.amaService.getAMAById(amaId);
        if (!ama) {
          console.warn(`AMA with ID ${amaId} not found`);
          continue;
        }

        const message = buildAMAMessage(ama);
        const groupId =
          ama.language === "ar" ? publicGroupIds.ar : publicGroupIds.en;

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const sent = await this.bot.telegram.sendPhoto(groupId, imageUrl, {
          caption: message,
          parse_mode: "HTML",
        });

        await this.bot.telegram.pinChatMessage(groupId, sent.message_id);

        const broadcastMsg = await this.bot.telegram.sendMessage(
          adminGroupId,
          `✅ AMA session ${ama.session_no} has been broadcasted.`,
          {
            message_thread_id: process.env.ADMIN_TOPIC_ID
              ? parseInt(process.env.ADMIN_TOPIC_ID)
              : undefined,
          }
        );

        // Only delete the scheduled time if the broadcast was successful
        if (broadcastMsg) {
          await this.amaService.deleteScheduledTime(scheduleId);
        }
      } catch {
        console.error(`Failed to broadcast AMA with ID ${amaId}:`, Error);
      }
    }
  }
}
