import { Module, forwardRef } from "@nestjs/common";
import { AMAService } from "./ama.service";
import { MessageQueueModule } from "../message-queue/message-queue.module";

@Module({
  imports: [forwardRef(() => MessageQueueModule)],
  providers: [AMAService],
  exports: [AMAService],
})
export class AMAModule {}
