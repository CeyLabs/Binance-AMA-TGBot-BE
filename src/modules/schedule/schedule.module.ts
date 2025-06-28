import { Module } from "@nestjs/common";
import { SchedulerService } from "./schedule.service";
import { AMAModule } from "../ama/ama.module";

@Module({
  imports: [AMAModule],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class ScheduleServicesModule {}
