import { Module, forwardRef } from "@nestjs/common";
import { MessageQueueService } from "./message-queue.service";
import { AMAModule } from "../ama/ama.module";

@Module({
  imports: [forwardRef(() => AMAModule)],
  providers: [MessageQueueService],
  exports: [MessageQueueService],
})
export class MessageQueueModule {}
