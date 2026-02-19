import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Player } from './player.entity';
import { WeeklyCycle } from './weekly-cycle.entity';
import { Submission } from './submission.entity';

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus =
  | 'new'
  | 'to_be_resolved'
  | 'fixed'
  | 'declined'
  | 'duplicate';

@Entity('issues')
export class Issue {
  @PrimaryColumn({ type: 'uuid', default: () => 'gen_random_uuid()' })
  id: string;

  @Column({ type: 'uuid', name: 'cycle_id', nullable: true })
  cycleId: string | null;

  @ManyToOne(() => WeeklyCycle, { nullable: true })
  @JoinColumn({ name: 'cycle_id' })
  cycle: WeeklyCycle | null;

  @Column({ type: 'text', name: 'reporter_user_id', nullable: false })
  reporterUserId: string;

  @ManyToOne(() => Player)
  @JoinColumn({ name: 'reporter_user_id', referencedColumnName: 'discordId' })
  reporter: Player;

  @Column({ type: 'uuid', name: 'linked_submission_id', nullable: true })
  linkedSubmissionId: string | null;

  @ManyToOne(() => Submission, { nullable: true })
  @JoinColumn({ name: 'linked_submission_id' })
  linkedSubmission: Submission | null;

  @Column({ type: 'text', nullable: false })
  title: string;

  @Column({ type: 'text', nullable: false })
  description: string;

  @Column({ type: 'text', name: 'repro_steps', nullable: true })
  reproSteps: string | null;

  @Column({
    type: 'text',
    nullable: false,
    default: 'medium',
  })
  severity: IssueSeverity;

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
    default: 'new',
  })
  status: IssueStatus;

  @Column({
    type: 'text',
    name: 'qa_comment_private',
    nullable: true,
  })
  qaCommentPrivate: string | null;

  @Column({
    type: 'text',
    name: 'qa_comment_public',
    nullable: true,
  })
  qaCommentPublic: string | null;

  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}
