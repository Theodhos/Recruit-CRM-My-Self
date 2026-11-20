import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ReplaceCandidateDto {
  @ApiProperty({ description: 'The candidate who works the job now and leaves it' })
  @IsString()
  @MinLength(1)
  fromCandidateId!: string;

  @ApiProperty({ description: 'The candidate who takes their place' })
  @IsString()
  @MinLength(1)
  toCandidateId!: string;
}
