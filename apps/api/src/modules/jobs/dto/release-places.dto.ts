import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ReleasePlacesDto {
  @ApiProperty({ description: 'How many filled places to free: the people who filled the job last lose their place' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  count!: number;

  @ApiPropertyOptional({ description: 'Only say who would lose their place; change nothing' })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
