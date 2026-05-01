import { IsString, IsOptional, IsEmail, IsInt, Min, Max, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({ example: 'Jane Doe', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'jane@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 30, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(150)
  age?: number;

  @ApiProperty({ example: 'MALE', required: false })
  @IsOptional()
  @IsEnum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'])
  gender?: string;

  @ApiProperty({ example: 'No known allergies', required: false })
  @IsOptional()
  @IsString()
  medicalBackground?: string;
}
