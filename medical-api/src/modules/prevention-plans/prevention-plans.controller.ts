import { Controller, Post, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PreventionPlansService } from './prevention-plans.service';

@ApiTags('prevention-plans')
@Controller('prevention-plans')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class PreventionPlansController {
  constructor(private readonly service: PreventionPlansService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate personalized prevention plan' })
  async generate(@Request() req: any) {
    return this.service.generate(req.user.id);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get active prevention plan' })
  async getActive(@Request() req: any) {
    return this.service.getActivePlan(req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all prevention plans' })
  async getAll(@Request() req: any) {
    return this.service.getAllPlans(req.user.id);
  }
}
