import { Injectable } from '@nestjs/common';
import { Lead } from './lead.entity';
import { LeadsRepository } from './leads.repository';

@Injectable()
export class LeadsService {
  constructor(private readonly leadsRepository: LeadsRepository) {}

  reassign(
    leadId: string,
    consultantId: string,
    changedById: string,
    note?: string,
  ): Promise<Lead> {
    return this.leadsRepository.reassign(
      leadId,
      consultantId,
      changedById,
      note,
    );
  }
}
