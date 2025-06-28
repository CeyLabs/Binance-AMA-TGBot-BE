import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { KnexService } from "./knex.service";

interface KnexPool {
  numFree: () => number;
  numUsed: () => number;
  numPendingAcquires: () => number;
}

interface KnexClient {
  pool: KnexPool;
}

@Injectable()
export class KnexConnectionManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KnexConnectionManager.name);
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private readonly PING_INTERVAL = 60000; // 1 minute

  constructor(private readonly knexService: KnexService) {}

  onModuleInit(): void {
    // Start the connection keep-alive mechanism
    this.startKeepAlive();
  }

  private startKeepAlive(): void {
    this.logger.log("Starting database connection keep-alive monitor");

    // Clear any existing interval
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    // Set up a new interval to ping the database
    this.keepAliveInterval = setInterval(() => {
      void this.pingAndHandle();
    }, this.PING_INTERVAL);
  }

  private async pingAndHandle(): Promise<void> {
    try {
      // Simple query to keep the connection alive
      await this.pingDatabase();
      this.logger.debug("Database ping successful");
    } catch (error) {
      this.logger.error("Database ping failed", error);
      // If ping fails, try to restart the connection
      await this.handleConnectionFailure();
    }
  }

  private async pingDatabase(): Promise<void> {
    await this.knexService.knex.raw("SELECT 1");
  }

  private async handleConnectionFailure(): Promise<void> {
    this.logger.warn("Attempting to recover database connection");

    try {
      // Get the current knex instance
      const knexInstance = this.knexService.knex;

      // Check the pool status
      const client = knexInstance.client as unknown as KnexClient;
      const pool = client.pool;

      if (pool) {
        // Log pool statistics with type-safe operations
        const numFree = typeof pool.numFree === "function" ? pool.numFree() : 0;
        const numUsed = typeof pool.numUsed === "function" ? pool.numUsed() : 0;
        const numPending =
          typeof pool.numPendingAcquires === "function"
            ? pool.numPendingAcquires()
            : 0;

        this.logger.log(
          `Pool stats - Available: ${numFree}, Used: ${numUsed}, Pending: ${numPending}`,
        );
      }

      // Force a new connection test
      await this.pingDatabase();
      this.logger.log("Connection recovery successful");
    } catch (error) {
      this.logger.error("Connection recovery failed", error);
    }
  }

  onModuleDestroy(): void {
    // Clean up the keep-alive interval
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
      this.logger.log("Database keep-alive monitor stopped");
    }
  }
}
