import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateCandidateZoomDto {
  @ApiProperty({ description: 'ISO 8601 date-time of the meeting' })
  @IsISO8601()
  scheduledAt!: string;

  @ApiPropertyOptional({ default: 45, minimum: 15, maximum: 480 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @Max(480)
  durationMinutes: number = 45;

  @ApiPropertyOptional({ description: 'IANA time zone the slot was picked in' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiPropertyOptional({ description: 'A message included in the invitation' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ default: false, description: 'E-mail the invitation to the candidate at once' })
  @IsOptional()
  @IsBoolean()
  sendInvite: boolean = false;
}
