import {
  Controller, Post, Get, Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ManualTestsService } from './manual-tests.service';

@ApiTags('manual-tests')
@Controller('manual-tests')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class ManualTestsController {
  constructor(private readonly service: ManualTestsService) {}

  @Get('schemas')
  @ApiOperation({ summary: 'Get all disease form schemas' })
  async getSchemas() {
    return this.service.getFormSchemas();
  }

  @Get('schemas/:disease')
  @ApiOperation({ summary: 'Get form schema for a specific disease' })
  async getSchema(@Param('disease') disease: string) {
    return this.service.getFormSchema(disease);
  }

  @Post('run')
  @ApiOperation({ summary: 'Run manual disease test' })
  async runTest(
    @Request() req: any,
    @Body() body: { disease: string; inputData: Record<string, any> },
  ) {
    return this.service.runTest(req.user.id, body);
  }

  @Get('my-tests')
  @ApiOperation({ summary: 'Get my manual test history' })
  async getMyTests(@Request() req: any) {
    return this.service.getUserTests(req.user.id);
  }
}
