import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser, UserRole } from '../auth/user-role';
import { Lead } from './lead.entity';
import { LeadsRepository } from './leads.repository';

@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.AcademicAdvisor, UserRole.TrainingManager)
export class LeadsController {
  constructor(private readonly leadsRepository: LeadsRepository) {}

  @Get()
  findAll(@Req() request: { user: AuthenticatedUser }): Promise<Lead[]> {
    return this.leadsRepository.findVisibleTo(request.user);
  }
}