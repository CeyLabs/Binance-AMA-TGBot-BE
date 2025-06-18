import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { KnexService } from "../knex/knex.service";
import { ConfigService } from "@nestjs/config";
import { buildAMAMessage, imageUrl } from "../ama/helper/msg-builder";
import { Telegraf } from "telegraf";
import { InjectBot } from "nestjs-telegraf";

@Injectable()
export class SchedulerService {
  constructor(
    private readonly knex: KnexService,
    private readonly config: ConfigService,
    @InjectBot() private readonly bot: Telegraf
  ) {}

  @Cron("*/1 * * * *") // every minute
  async broadcastScheduledAMAs() {
    const now = new Date();
    console.log("Checking for scheduled AMAs to broadcast...");

    const amas = await this.knex
      .knex("ama")
      .whereNotNull("scheduled_at")
      .where("scheduled_at", "<=", now)
      .where("status", "scheduled");

    for (const ama of amas) {
      const publicGroupId = this.config.get<string>("PUBLIC_GROUP_ID")!;
      const adminGroupId = this.config.get<string>("ADMIN_GROUP_ID")!;
      const message = buildAMAMessage(ama);

      const result = await new Promise((resolve) =>
        setTimeout(() => resolve("wait 1s between each send"), 1000)
      );

      const sent = await this.bot.telegram.sendPhoto(publicGroupId, imageUrl, {
        caption: message,
        parse_mode: "HTML",
      });

      await this.bot.telegram.pinChatMessage(publicGroupId, sent.message_id);

      await this.knex
        .knex("ama")
        .where({ session_no: ama.session_no })
        .update({ status: "broadcasted" });

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
