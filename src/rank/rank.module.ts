import { Module, forwardRef } from '@nestjs/common';
import { RankService } from './rank.service';
import { TesterArmyModule } from '../tester-army/tester-army.module';
import { SubmissionModule } from '../submission/submission.module';

@Module({
  imports: [TesterArmyModule, forwardRef(() => SubmissionModule)],
  providers: [RankService],
  exports: [RankService],
})
export class RankModule {}
