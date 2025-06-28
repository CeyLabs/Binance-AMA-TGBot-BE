import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { Command, Update } from "nestjs-telegraf";

@Update()
@Injectable()
export class HelpService {
  constructor() {}

  @Command("help")
  async handleHelpCommand(ctx: Context): Promise<void> {
    await ctx.reply(
      "This is the help command. Here you can find information about how to use the bot.",
    );
  }
}
