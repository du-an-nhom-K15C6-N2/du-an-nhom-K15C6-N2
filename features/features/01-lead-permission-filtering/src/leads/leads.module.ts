import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '../auth/roles.guard';
import { Lead } from './lead.entity';
import { LeadsController } from './leads.controller';
import { LeadsRepository } from './leads.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Lead])],
  controllers: [LeadsController],
  providers: [LeadsRepository, RolesGuard],
})
export class LeadsModule {}