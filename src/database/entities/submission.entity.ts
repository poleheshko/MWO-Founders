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
import { WeeklyCycle } from './weekly-cycle.entity';

export type SubmissionType =
  | 'quick_test'
  | 'survey'
  | 'screenshot'
  | 'bug_repro'
  | 'bug_video'
  | 'balance_analysis'
  | 'retest'
  | 'shipped_bonus'
  | 'manual_adjust'
  // Delivered features - exempt from 200 TC per build cap
  | 'structured_report_bonus'
  | 'video_session'
  | 'playtime_minimum';

export type SubmissionStatus = 'pending' | 'approved' | 'declined';

export type QaStatus = 
  | 'qa_please_check' 
  | 'no_need_auto_points' 
  | 'no_need_duplicate' 
  | null;

@Entity('submissions')
@Index('idx_submissions_user', ['discordUserId'])
@Index('idx_submissions_cycle', ['cycleId'])
@Index('idx_submissions_status', ['status'])
@Index('idx_submissions_type', ['type'])
export class Submission {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id: string;

  @Column({ type: 'text', name: 'discord_user_id', nullable: false })
  discordUserId: string;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'discord_user_id', referencedColumnName: 'discordId' })
  user: Player;

  @Column({ type: 'uuid', name: 'cycle_id', nullable: true })
  cycleId: string | null;

  @ManyToOne(() => WeeklyCycle, { nullable: true })
  @JoinColumn({ name: 'cycle_id' })
  cycle: WeeklyCycle | null;

  @Column({ type: 'text', nullable: false })
  type: SubmissionType;

  @Column({
    type: 'jsonb',
    name: 'payload_json',
    nullable: false,
    default: '{}',
  })
  payloadJson: Record<string, any>;

  @Column({
    type: 'jsonb',
    name: 'evidence_urls',
    nullable: false,
    default: '[]',
  })
  evidenceUrls: string[];

  @Column({
    type: 'text',
    nullable: false,
    default: 'pending',
  })
  status: SubmissionStatus;

  @Column({
    type: 'int',
    name: 'tc_proposed',
    nullable: false,
    default: 0,
  })
  tcProposed: number;

  @Column({
    type: 'int',
    name: 'tc_awarded',
    nullable: false,
    default: 0,
  })
  tcAwarded: number;

  @Column({ type: 'bigint', name: 'reviewed_by', nullable: true })
  reviewedBy: string | null;

  @ManyToOne(() => Player, { nullable: true })
  @JoinColumn({ name: 'reviewed_by', referencedColumnName: 'discordId' })
  reviewer: Player | null;

  @Column({
    type: 'text',
    name: 'review_comment_private',
    nullable: true,
  })
  reviewCommentPrivate: string | null;

  @Column({
    type: 'text',
    name: 'review_comment_public',
    nullable: true,
  })
  reviewCommentPublic: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @Column({ type: 'timestamp', name: 'reviewed_at', nullable: true })
  reviewedAt: Date | null;

  @Column({
    type: 'text',
    name: 'qa_status',
    nullable: true,
  })
  qaStatus: QaStatus;

  @Column({
    type: 'text',
    name: 'qa_build_version',
    nullable: true,
  })
  qaBuildVersion: string | null;
}
