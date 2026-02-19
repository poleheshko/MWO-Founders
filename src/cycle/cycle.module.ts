import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CycleService } from './cycle.service';
import { WeeklyCycle } from '../database/entities/weekly-cycle.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WeeklyCycle])],
  providers: [CycleService],
  exports: [CycleService],
})
export class CycleModule {}
