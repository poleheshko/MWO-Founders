import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Player } from './player.entity';

export type CycleStatus = 'draft' | 'published' | 'closed';

@Entity('weekly_cycles')
@Index('idx_weekly_cycles_week_start', ['weekStart'])
export class WeeklyCycle {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id: string;

  @Column({ type: 'date', name: 'week_start', nullable: false })
  weekStart: Date;

  @Column({ type: 'date', name: 'week_end', nullable: false })
  weekEnd: Date;

  @Column({ type: 'text', name: 'build_version', nullable: false })
  buildVersion: string;

  @Column({ type: 'text', name: 'build_link', nullable: true })
  buildLink: string | null;

  @Column({ type: 'text', name: 'app_store_link', nullable: true })
  appStoreLink: string | null;

  @Column({ type: 'text', name: 'google_play_link', nullable: true })
  googlePlayLink: string | null;

  @Column({ type: 'timestamp', name: 'closed_at', nullable: true })
  closedAt: Date | null;

  @Column({
    type: 'jsonb',
    name: 'quick_missions_json',
    nullable: false,
    default: '[]',
  })
  quickMissionsJson: any[];

  @Column({ type: 'jsonb', name: 'advanced_mission_json', nullable: true })
  advancedMissionJson: any | null;

  @Column({
    type: 'text',
    nullable: false,
    default: 'draft',
  })
  status: CycleStatus;

  @Column({ type: 'text', name: 'created_by', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'created_by', referencedColumnName: 'discordId' })
  creator: Player | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;
}
