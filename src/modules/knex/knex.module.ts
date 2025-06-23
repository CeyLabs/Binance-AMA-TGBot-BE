import { Global, Module } from "@nestjs/common";
import { KnexService } from "./knex.service";
import { KnexConnectionManager } from "./knex-connection-manager";

@Global()
@Module({
  providers: [KnexService, KnexConnectionManager],
  exports: [KnexService],
})
export class KnexModule {}
