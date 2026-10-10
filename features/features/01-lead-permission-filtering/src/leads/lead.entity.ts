import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'leads' })
export class Lead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'assigned_to', type: 'uuid', nullable: true })
  assignedToId!: string | null;
}