import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateReportDto {
  @ApiProperty({ example: 'patient_report_2024.pdf' })
  @IsString()
  fileUrl!: string;

  @ApiProperty({ example: 'patient_report_2024.pdf', required: false })
  @IsString()
  @IsOptional()
  fileName?: string;

  @ApiProperty({
    example: { diagnosis: 'Sample', notes: 'Test' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  @Type(() => Object)
  extractedData?: Record<string, any>;
}
