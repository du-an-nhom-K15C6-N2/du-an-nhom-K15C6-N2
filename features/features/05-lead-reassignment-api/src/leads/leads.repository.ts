import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserRole } from '../auth/user-role';
import { Consultant } from './consultant.entity';
import { Lead } from './lead.entity';
import { LeadAssignmentHistory } from './lead-assignment-history.entity';

@Injectable()
export class LeadsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async reassign(
    leadId: string,
    consultantId: string,
    changedById: string,
    note?: string,
  ): Promise<Lead> {
    return this.dataSource.transaction(async (manager) => {
      const leadRepository = manager.getRepository(Lead);
      const lead = await leadRepository.findOne({
        where: { id: leadId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lead) {
        throw new NotFoundException('Lead not found');
      }

      const consultant = await manager.getRepository(Consultant).findOne({
        where: {
          id: consultantId,
          role: UserRole.AcademicAdvisor,
          isActive: true,
        },
      });

      if (!consultant) {
        throw new NotFoundException('Active academic advisor not found');
      }

      if (lead.assignedToId === consultant.id) {
        throw new BadRequestException(
          'Lead is already assigned to this consultant',
        );
      }

      const previousAssigneeId = lead.assignedToId;
      lead.assignedToId = consultant.id;
      const updatedLead = await leadRepository.save(lead);

      await manager.getRepository(LeadAssignmentHistory).save({
        leadId: lead.id,
        fromAssignedToId: previousAssigneeId,
        toAssignedToId: consultant.id,
        changedById,
        note: note?.trim() || null,
      });

      return updatedLead;
    });
  }
}
