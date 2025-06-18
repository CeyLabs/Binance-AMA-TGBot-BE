import { Module } from '@nestjs/common';
import { SchedulerService } from './schedule-services.service';
import { AMAModule } from '../ama/ama.module';
import { KnexModule } from '../knex/knex.module';

@Module({
    imports: [AMAModule, KnexModule],
    providers: [SchedulerService],
    exports: [SchedulerService],
})

export class ScheduleServicesModule {}
