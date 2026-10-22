import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AuthenticatedUser, UserRole } from '../auth/user-role';
import { Lead } from './lead.entity';
import { ReassignLeadDto } from './reassign-lead.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TrainingManager)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Patch(':id/reassign')
  reassign(
    @Param('id', ParseUUIDPipe) leadId: string,
    @Body(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
    body: ReassignLeadDto,
    @Req() request: { user: AuthenticatedUser },
  ): Promise<Lead> {
    return this.leadsService.reassign(
      leadId,
      body.consultantId,
      request.user.id,
      body.note,
    );
  }
}
