import { ConsoleLogger, Injectable } from "@nestjs/common";
import { KnexService } from "../modules/knex/knex.service";

@Injectable()
export class DbLoggerService extends ConsoleLogger {
  constructor(private readonly knexService: KnexService) {
    super();
  }

  private async save(level: string, message: string, actor?: string): Promise<void> {
    try {
      await this.knexService.knex("log").insert({ level, text: message, actor });
    } catch (err) {
      super.error(`Failed to write log to DB: ${(err as Error).message}`);
    }
  }

  override log(message: string, actor?: string) {
    super.log(message);
    void this.save("info", message, actor);
  }

  override error(message: string, stack?: string, actor?: string) {
    super.error(message, stack);
    void this.save("error", stack ? `${message}\n${stack}` : message, actor);
  }

  override warn(message: string, actor?: string) {
    super.warn(message);
    void this.save("warn", message, actor);
  }

  override debug(message: string, actor?: string) {
    super.debug(message);
    void this.save("info", message, actor);
  }

  override verbose(message: string, actor?: string) {
    super.verbose(message);
    void this.save("info", message, actor);
  }
}
