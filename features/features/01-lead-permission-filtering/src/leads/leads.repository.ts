import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthenticatedUser, UserRole } from '../auth/user-role';
import { Lead } from './lead.entity';

@Injectable()
export class LeadsRepository {
  constructor(
    @InjectRepository(Lead)
    private readonly repository: Repository<Lead>,
  ) {}

  findVisibleTo(user: AuthenticatedUser): Promise<Lead[]> {
    const query = this.repository.createQueryBuilder('lead');

    switch (user.role) {
      case UserRole.AcademicAdvisor:
        return query
          .where('lead.assignedToId = :userId', { userId: user.id })
          .getMany();
      case UserRole.TrainingManager:
        return query.getMany();
      default:
        throw new ForbiddenException('Unsupported role for lead access');
    }
  }
}