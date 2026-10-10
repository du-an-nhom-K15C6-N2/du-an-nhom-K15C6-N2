import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class ReassignLeadDto {
  @IsUUID()
  consultantId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
