import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  Index,
} from 'typeorm';

/**
 * Stores in-game player ID per build (e.g. 2.10–2.17).
 * Lets you map which player ID belongs to which Discord user/email for each build.
 */
@Entity('player_build_ids')
@Unique('UQ_player_build_ids_discord_build', ['discordId', 'buildVersion'])
@Index('idx_player_build_ids_build_player', ['buildVersion', 'playerId'])
export class PlayerBuildId {
  @PrimaryColumn({ type: 'text', name: 'discord_id' })
  discordId: string;

  @PrimaryColumn({ type: 'text', name: 'build_version' })
  buildVersion: string;

  @Column({ type: 'text', name: 'player_id' })
  playerId: string;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
