import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlayerService } from './player.service';
import { PlayerBuildIdService } from './player-build-id.service';
import { Player } from '../database/entities/player.entity';
import { PlayerBuildId } from '../database/entities/player-build-id.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Player, PlayerBuildId])],
  providers: [PlayerService, PlayerBuildIdService],
  exports: [PlayerService, PlayerBuildIdService],
})
export class PlayerModule {}
