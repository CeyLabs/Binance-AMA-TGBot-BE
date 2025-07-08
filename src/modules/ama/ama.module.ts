import { Module } from "@nestjs/common";
import { AMAService } from "./ama.service";
import { DbLoggerService } from "../../logger/db-logger.service";

@Module({
  imports: [],
  providers: [AMAService, DbLoggerService],
  exports: [AMAService],
})
export class AMAModule {}
