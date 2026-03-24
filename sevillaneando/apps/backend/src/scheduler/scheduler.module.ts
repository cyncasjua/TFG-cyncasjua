import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScrapingScheduler } from './scraping.scheduler';
import { ScrapingModule } from '../scraping/scraping.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ScrapingModule,
  ],
  providers: [ScrapingScheduler],
})
export class SchedulerModule {}
