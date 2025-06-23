import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { buildAMAMessage, imageUrl } from "../ama/helper/msg-builder";
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
    console.log("Checking for scheduled AMAs to broadcast...");

    const amas = await this.amaService.getScheduledAMAsToBroadcast(now);

    for (const ama of amas) {
      const publicGroupId = this.config.get<string>("PUBLIC_GROUP_ID")!;
      const adminGroupId = this.config.get<string>("ADMIN_GROUP_ID")!;
      const message = buildAMAMessage(ama);

      await new Promise((resolve) =>
        setTimeout(() => resolve("wait 1s between each send"), 1000)
      );

      const sent = await this.bot.telegram.sendPhoto(publicGroupId, imageUrl, {
        caption: message,
        parse_mode: "HTML",
      });

      await this.bot.telegram.pinChatMessage(publicGroupId, sent.message_id);

      await this.amaService.updateAMA(ama.id, {
        status: "broadcasted",
        scheduled_at: undefined,
      });

      await this.bot.telegram.sendMessage(
        adminGroupId,
        `AMA session ${ama.session_no} has been broadcasted successfully!`,
        {
          message_thread_id: process.env.ADMIN_TOPIC_ID
            ? parseInt(process.env.ADMIN_TOPIC_ID)
            : undefined,
        }
      );
    }
  }
}
