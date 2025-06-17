import { Module } from "@nestjs/common";
import { NewAMAService } from "./new-ama.service";

@Module({
  imports: [],
  providers: [NewAMAService],
  exports: [NewAMAService],
})
export class NewAMAModule {}
