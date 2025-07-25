import { Module } from "@nestjs/common";
import { AMAService } from "./ama.service";
import { DbLoggerService } from "../../logger/db-logger.service";
import { PermissionsService } from "./permissions.service";

@Module({
  imports: [],
  providers: [AMAService, DbLoggerService, PermissionsService],
  exports: [AMAService, PermissionsService],
})
export class AMAModule {}
