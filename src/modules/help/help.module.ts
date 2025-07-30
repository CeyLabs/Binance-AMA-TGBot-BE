import { Module } from "@nestjs/common";
import { HelpService } from "./help.service";
import { KnexModule } from "../knex/knex.module";

@Module({
  imports: [KnexModule],
  providers: [HelpService],
  exports: [HelpService],
})
export class HelpModule {}
