import {
  Controller, Post, Get, Patch, Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TransportationService } from './transportation.service';

@ApiTags('transportation')
@Controller('transportation')
@ApiBearerAuth('JWT')
@UseGuards(AuthGuard('jwt'))
export class TransportationController {
  constructor(private readonly service: TransportationService) {}

  @Post('book')
  @ApiOperation({ summary: 'Book transportation' })
  async book(@Request() req: any, @Body() body: any) {
    return this.service.book(req.user.id, body);
  }

  @Get('my-bookings')
  @ApiOperation({ summary: 'Get my transportation bookings' })
  async getMyBookings(@Request() req: any) {
    return this.service.getUserBookings(req.user.id);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel transportation booking' })
  async cancel(@Param('id') id: string) {
    return this.service.cancel(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update booking status' })
  async updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.service.updateStatus(id, body.status);
  }
}
