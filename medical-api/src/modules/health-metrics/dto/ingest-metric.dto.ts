import { IsString, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IngestMetricDto {
  @ApiProperty({ example: 'blood_pressure', description: 'Metric key (e.g., blood_pressure, heart_rate)' })
  @IsString()
  metricKey!: string;

  @ApiProperty({ example: 120, description: 'Metric value' })
  @IsNumber()
  value!: number;

  @ApiProperty({ example: 'mmHg', description: 'Unit of measurement', required: false })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiProperty({ example: 'manual', description: 'Source of metric (manual, apple_health, google_fit, wearable)', required: false })
  @IsOptional()
  @IsString()
  source?: string;
}
