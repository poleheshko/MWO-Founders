import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionService } from './submission.service';
import { Submission } from '../database/entities/submission.entity';
import { TesterArmyModule } from '../tester-army/tester-army.module';
import { RankModule } from '../rank/rank.module';
import { CycleModule } from '../cycle/cycle.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission]),
    TesterArmyModule,
    CycleModule,
    forwardRef(() => RankModule),
  ],
  providers: [SubmissionService],
  exports: [SubmissionService],
})
export class SubmissionModule {}
