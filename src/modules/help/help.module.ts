import { Module } from "@nestjs/common";
import { HelpService } from "./help.service";

@Module({
  imports: [],
  providers: [HelpService],
  exports: [HelpService],
})
export class HelpModule {}
