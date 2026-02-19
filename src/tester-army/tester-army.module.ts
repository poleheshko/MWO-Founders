import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TesterArmyService } from './tester-army.service';
import { ArmyTester } from '../database/entities/army-tester.entity';
import { PlayerModule } from '../player/player.module';

@Module({
  imports: [TypeOrmModule.forFeature([ArmyTester]), PlayerModule],
  providers: [TesterArmyService],
  exports: [TesterArmyService],
})
export class TesterArmyModule {}
