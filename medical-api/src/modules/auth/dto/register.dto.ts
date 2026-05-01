import { IsEmail, IsString, MinLength, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'PATIENT', enum: ['PATIENT', 'DOCTOR'], required: false })
  @IsOptional()
  @IsEnum(['PATIENT', 'DOCTOR'])
  role?: 'PATIENT' | 'DOCTOR';

  @ApiProperty({ example: 30, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(150)
  age?: number;

  @ApiProperty({ example: 'MALE', enum: ['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'], required: false })
  @IsOptional()
  @IsEnum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'])
  gender?: string;

  @ApiProperty({ example: 'No known allergies', required: false })
  @IsOptional()
  @IsString()
  medicalBackground?: string;

  @ApiProperty({ example: 'Cardiology', required: false, description: 'Required for doctors' })
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiProperty({ example: 'MD-12345', required: false })
  @IsOptional()
  @IsString()
  licenseNo?: string;
}
