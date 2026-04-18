import { IsString, IsUUID, IsNumber, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreatePredictionDto {
  @ApiProperty({ example: 'report-uuid' })
  @IsUUID()
  reportId!: string;

  @ApiProperty({ example: 'Pneumonia' })
  @IsString()
  disease!: string;

  @ApiProperty({ example: 0.95 })
  @IsNumber()
  confidence!: number;

  @ApiProperty({
    example: 'Based on chest X-ray findings...',
    required: false,
  })
  @IsString()
  @IsOptional()
  explanation?: string;

  @ApiProperty({ example: { model: 'v1.0' }, required: false })
  @IsObject()
  @IsOptional()
  @Type(() => Object)
  metadata?: Record<string, any>;
}
