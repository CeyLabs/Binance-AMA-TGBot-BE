import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { Command, Update } from "nestjs-telegraf";

@Update()
@Injectable()
export class HelpService {
  constructor() {}

  @Command("help")
  async handleHelpCommand(ctx: Context): Promise<void> {
    const adminGroupId = process.env.ADMIN_GROUP_ID;
    if (ctx.chat?.type !== "private" && ctx.chat?.id?.toString() !== adminGroupId) {
      try {
        await ctx.deleteMessage();
      } catch (err) {
        console.error('Failed to delete command message', err);
      }
      return;
    }

    await ctx.reply(
      "This is the help command. Here you can find information about how to use the bot.",
    );
  }
}
