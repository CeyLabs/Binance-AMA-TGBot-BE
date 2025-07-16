import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { Command, Update } from "nestjs-telegraf";
import { blockIfNotAdminGroup } from "../../utils/command-utils";

@Update()
@Injectable()
export class HelpService {
  constructor() {}

  @Command("help")
  async handleHelpCommand(ctx: Context): Promise<void> {
    const adminGroupId = process.env.ADMIN_GROUP_ID!;
    if (await blockIfNotAdminGroup(ctx, adminGroupId)) return;

    await ctx.reply(
      "This is the help command. Here you can find information about how to use the bot.",
    );
  }
}
