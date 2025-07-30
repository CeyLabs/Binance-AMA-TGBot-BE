import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { Command, Update } from "nestjs-telegraf";
import { ConfigService } from "@nestjs/config";
import { blockIfNotAdminGroup } from "../../utils/command-utils";
import { KnexService } from "../knex/knex.service";
import { UserRole } from "../ama/types";

@Update()
@Injectable()
export class HelpService {
  constructor(
    private readonly config: ConfigService,
    private readonly knexService: KnexService,
  ) {}

  async getUserRole(userId: string): Promise<UserRole | null> {
    const user = await this.knexService
      .knex<{ role: UserRole }>("user")
      .where("user_id", userId)
      .first();
    return user ? user.role : null;
  }

  private getBotOwnerId(): string {
    const ownerId = this.config.get<string>("BOT_OWNER_ID");
    if (!ownerId) {
      throw new Error("BOT_OWNER_ID is not defined");
    }
    return ownerId;
  }

  private isBotOwner(userId: string): boolean {
    return userId === this.getBotOwnerId();
  }

  @Command("help")
  async handleHelpCommand(ctx: Context): Promise<void> {
    const adminGroupId = this.config.get<string>("ADMIN_GROUP_ID")!;
    if (await blockIfNotAdminGroup(ctx, adminGroupId)) return;

    const userId = ctx.from?.id.toString();
    if (!userId) {
      await ctx.reply("Unable to identify user.");
      return;
    }

    const userRole = await this.getUserRole(userId);
    const isBotOwner = this.isBotOwner(userId);

    let helpMessage = `<b>🤖 AMA Bot Commands</b>\n\n`;

    // Commands available to all users in admin group
    helpMessage += `<b>📋 General Commands:</b>\n`;
    helpMessage += `• /help - Show this help message\n`;
    helpMessage += `• /start - Bot start command\n\n`;

    // Commands for users with elevated permissions
    if (userRole && userRole !== 'regular') {
      helpMessage += `<b>🎯 AMA Management:</b>\n`;
      
      // Commands available to host, editor, ama, admin
      if (['host', 'editor', 'ama', 'admin'].includes(userRole) || isBotOwner) {
        helpMessage += `• /startama &lt;sessionNo&gt; - Start an AMA session\n`;
        helpMessage += `• /endama &lt;sessionNo&gt; - End an AMA session\n`;
        helpMessage += `• /selectwinners &lt;sessionNo&gt; - Select winners for completed AMA\n`;
      }

      // Commands available to editor, ama, admin
      if (['editor', 'ama', 'admin'].includes(userRole) || isBotOwner) {
        helpMessage += `• /newama &lt;language&gt; &lt;sessionNo&gt; - Create/edit AMA session\n`;
        helpMessage += `• Edit announcements (via inline buttons)\n`;
      }

      // Commands available to ama, admin
      if (['ama', 'admin'].includes(userRole) || isBotOwner) {
        helpMessage += `• Broadcast announcements (via inline buttons)\n`;
      }

      helpMessage += `\n`;
    }

    // Permission management commands (admin and bot owner only)
    if (userRole === 'admin' || isBotOwner) {
      helpMessage += `<b>👥 User Management:</b>\n`;
      helpMessage += `• /access - View all non-regular users and their roles\n`;
      helpMessage += `• /grantadmin &lt;user_id|@username&gt; - Grant admin privileges\n`;
      helpMessage += `• /grantama &lt;user_id|@username&gt; - Grant AMA management privileges\n`;
      helpMessage += `• /granteditor &lt;user_id|@username&gt; - Grant editor privileges\n`;
      helpMessage += `• /granthost &lt;user_id|@username&gt; - Grant host privileges\n`;
      helpMessage += `• /grantregular &lt;user_id|@username&gt; - Remove elevated privileges\n\n`;

      helpMessage += `<b>💡 Grant Command Usage:</b>\n`;
      helpMessage += `• Use Telegram user ID: /grantadmin 123456789\n`;
      helpMessage += `• Use username: /grantadmin @username\n`;
      helpMessage += `• Reply to message: Reply with /grantadmin\n\n`;
    }

    // Role hierarchy information
    helpMessage += `<b>🏆 Role Hierarchy:</b>\n`;
    if (isBotOwner) {
      helpMessage += `• <b>Bot Owner</b> - Ultimate access <b>[You]</b>\n`;
    }
    helpMessage += `• <b>Admin</b> - Full access + user management${userRole === 'admin' && !isBotOwner ? ' <b>[You]</b>' : ''}\n`;
    helpMessage += `• <b>AMA Manager</b> - Full AMA access (no user management)${userRole === 'ama' ? ' <b>[You]</b>' : ''}\n`;
    helpMessage += `• <b>Editor</b> - Edit announcements, start/end AMAs, select winners${userRole === 'editor' ? ' <b>[You]</b>' : ''}\n`;
    helpMessage += `• <b>Host</b> - Start/end AMAs, select winners${userRole === 'host' ? ' <b>[You]</b>' : ''}\n`;
    helpMessage += `• <b>Regular</b> - No bot management access${userRole === 'regular' || !userRole ? ' <b>[You]</b>' : ''}\n\n`;

    if (userRole) {
      const roleDisplay = isBotOwner ? 'Bot Owner' : 
                         userRole === 'ama' ? 'AMA Manager' : 
                         userRole.charAt(0).toUpperCase() + userRole.slice(1);
      helpMessage += `<b>Your current role:</b> ${roleDisplay}\n\n`;
    } else {
      helpMessage += `<b>Your current role:</b> Regular (no bot access)\n\n`;
    }

    helpMessage += `<b>🔔 Subscription Commands (Private Chat):</b>\n`;
    helpMessage += `• /start subscribe_en - Subscribe to English AMA notifications\n`;
    helpMessage += `• /start subscribe_ar - Subscribe to Arabic AMA notifications\n`;

    await ctx.reply(helpMessage, { parse_mode: "HTML" });
  }
}
