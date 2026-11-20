import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * What the public "Create account" form of the home page posts. The endpoint is open to the internet, so every
 * field is bounded and the global ValidationPipe rejects anything extra. No password is ever part of it: a request
 * is only an introduction, and an e-mail must never carry a secret.
 */
export class RegistrationRequestDto {
  @ApiProperty({ example: 'Acme Recruiting' })
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  organisationName!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  firstName!: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  lastName!: string;

  @ApiProperty()
  @Transform(trim)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @ApiPropertyOptional()
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;
}
