import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('players')
@Index('idx_players_username', ['discordUsername'])
@Index('idx_players_player_id', ['playerId'])
@Index('idx_players_email', ['email'])
export class Player {
  @PrimaryColumn({ type: 'text', name: 'discord_id' })
  discordId: string;

  @Column({ type: 'text', name: 'discord_username', nullable: true })
  discordUsername: string | null;

  @Column({ type: 'text', name: 'discord_nickname', nullable: true })
  discordNickname: string | null;

  @Column({ type: 'text', name: 'player_id', nullable: true })
  playerId: string | null;

  @Column({ type: 'text', name: 'email', nullable: true })
  email: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
