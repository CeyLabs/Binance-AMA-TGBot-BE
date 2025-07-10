import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { Knex, knex as createKnex } from "knex";
import config from "../../../knexfile";

type KnexConfig = Record<string, Knex.Config>;

interface IDbConnection {
  query: (
    sql: string,
    callback: (err: Error | null, result?: unknown) => void,
  ) => void;
}

@Injectable()
export class KnexService implements OnModuleInit, OnModuleDestroy {
  public knex!: Knex;
  private readonly logger = new Logger(KnexService.name);
  private readonly NODE_ENV = process.env.NODE_ENV || "development";

  onModuleInit(): void {
    // Use the appropriate environment configuration
    const configToUse =
      (config as KnexConfig)[this.NODE_ENV] ||
      (config as KnexConfig).development;

    // Ensure pool settings are properly configured
    const poolConfig: Knex.PoolConfig = {
      min: 2,
      max: 50,
      // Add a connection validator
      afterCreate: (
        conn: IDbConnection,
        done: (err: Error | null, connection?: IDbConnection) => void,
      ) => {
        // Setup connection
        conn.query("SELECT 1", (err: Error | null) => {
          if (err) {
            this.logger.error("Error during connection validation", err);
            done(err, conn);
          } else {
            done(null, conn);
          }
        });
      },
      // Set proper timeouts to prevent idle connection termination
      idleTimeoutMillis: 30000, // 30 seconds
      acquireTimeoutMillis: 30000, // 30 seconds
      // Ping the connection to keep it alive
      createTimeoutMillis: 30000, // 30 seconds
      // Check if the connection is still valid before using it
      reapIntervalMillis: 1000, // 1 second
      createRetryIntervalMillis: 100, // 0.1 seconds
    };

    // Initialize knex with enhanced configuration
    this.knex = createKnex({
      ...configToUse,
      pool: {
        ...(configToUse.pool || {}),
        ...poolConfig,
      },
    });

    // Log when connections open or close for debugging
    this.knex.on("query-error", (error: Error, query: { sql: string }) => {
      this.logger.error(`Query error: ${error.message}`, {
        error,
        query: query.sql,
      });
    });

    this.logger.log("Database connection established successfully");
  }

  async onModuleDestroy(): Promise<void> {
    if (this.knex) {
      try {
        await this.knex.destroy();
        this.logger.log("Database connection closed gracefully");
      } catch (error) {
        this.logger.error("Error closing database connection", error);
      }
    }
  }
}
