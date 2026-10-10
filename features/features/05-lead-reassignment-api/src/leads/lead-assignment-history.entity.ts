import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'lead_assignment_history' })
@Index('IDX_lead_assignment_history_lead_created', ['leadId', 'createdAt'])
export class LeadAssignmentHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'lead_id', type: 'uuid' })
  leadId!: string;

  @Column({ name: 'from_assigned_to', type: 'uuid', nullable: true })
  fromAssignedToId!: string | null;

  @Column({ name: 'to_assigned_to', type: 'uuid' })
  toAssignedToId!: string;

  @Column({ name: 'changed_by', type: 'uuid' })
  changedById!: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt!: Date;
}
