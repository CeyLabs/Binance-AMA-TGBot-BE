import { Module } from "@nestjs/common";
import { AMAService } from "./ama.service";

@Module({
  imports: [],
  providers: [AMAService],
  exports: [AMAService],
})
export class AMAModule {}
