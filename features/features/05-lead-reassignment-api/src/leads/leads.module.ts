import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/roles.guard';
import { Consultant } from './consultant.entity';
import { Lead } from './lead.entity';
import { LeadAssignmentHistory } from './lead-assignment-history.entity';
import { LeadsController } from './leads.controller';
import { LeadsRepository } from './leads.repository';
import { LeadsService } from './leads.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Lead, Consultant, LeadAssignmentHistory]),
  ],
  controllers: [LeadsController],
  providers: [LeadsRepository, LeadsService, RolesGuard],
  exports: [LeadsService],
})
export class LeadsModule {}
