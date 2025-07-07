import { ConsoleLogger, Injectable } from "@nestjs/common";
import { KnexService } from "../modules/knex/knex.service";

@Injectable()
export class DbLoggerService extends ConsoleLogger {
  constructor(private readonly knexService: KnexService) {
    super();
  }

  private async save(level: string, message: string): Promise<void> {
    try {
      await this.knexService.knex("log").insert({ level, text: message });
    } catch (err) {
      super.error(`Failed to write log to DB: ${(err as Error).message}`);
    }
  }

  override log(message: string) {
    super.log(message);
    void this.save("info", message);
  }

  override error(message: string, stack?: string) {
    super.error(message, stack);
    void this.save("error", stack ? `${message}\n${stack}` : message);
  }

  override warn(message: string) {
    super.warn(message);
    void this.save("warn", message);
  }

  override debug(message: string) {
    super.debug(message);
    void this.save("info", message);
  }

  override verbose(message: string) {
    super.verbose(message);
    void this.save("info", message);
  }
}
