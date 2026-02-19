import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Player } from './player.entity';

export type TesterStatus = 'active' | 'left' | 'banned';
export type TesterRank = 'recruit' | 'explorer' | 'test_pilot' | 'founders_circle';

@Entity('army_testers')
@Index('idx_army_testers_rank', ['currentRank'])
@Index('idx_army_testers_status', ['status'])
export class ArmyTester {
  @PrimaryColumn({ type: 'text', name: 'discord_user_id' })
  discordUserId: string;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'discord_user_id', referencedColumnName: 'discordId' })
  user: Player;

  @Column({
    type: 'text',
    nullable: false,
    default: 'active',
  })
  status: TesterStatus;

  @CreateDateColumn({ type: 'timestamp', name: 'joined_at' })
  joinedAt: Date;

  @Column({ type: 'timestamp', name: 'left_at', nullable: true })
  leftAt: Date | null;

  @Column({
    type: 'text',
    name: 'current_rank',
    nullable: false,
    default: 'recruit',
  })
  currentRank: TesterRank;

  @Column({
    type: 'int',
    name: 'tc_confirmed_total',
    nullable: false,
    default: 0,
  })
  tcConfirmedTotal: number;

  @Column({
    type: 'int',
    name: 'tc_pending_total',
    nullable: false,
    default: 0,
  })
  tcPendingTotal: number;

  @Column({
    type: 'int',
    name: 'structured_reports_confirmed',
    nullable: false,
    default: 0,
  })
  structuredReportsConfirmed: number;

  @Column({ type: 'timestamp', name: 'last_activity_at', nullable: true })
  lastActivityAt: Date | null;

  @Column({ type: 'jsonb', name: 'metadata_json', nullable: true })
  metadataJson: Record<string, any> | null;
}
