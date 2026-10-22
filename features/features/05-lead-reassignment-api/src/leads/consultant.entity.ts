import { Column, Entity, PrimaryColumn } from 'typeorm';
import { UserRole } from '../auth/user-role';

@Entity({ name: 'users' })
export class Consultant {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar' })
  role!: UserRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
