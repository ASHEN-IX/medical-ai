import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { RoleGuard } from '../../common/guards/role.guard';
import { UserRole } from '@prisma/client';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved' })
  async getMe(@Request() req: any) {
    return this.usersService.getMe(req.user.id);
  }

  @Get('doctors')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get list of available doctors' })
  async getDoctors() {
    return this.usersService.getDoctors();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), RoleGuard)
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get user by ID (Doctor/Admin only)' })
  @ApiResponse({ status: 200, description: 'User found' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'User updated' })
  async updateUser(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: any,
  ) {
    if (req.user.id !== id && req.user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('You can only update your own profile');
    }
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), RoleGuard)
  @Roles(UserRole.DOCTOR, UserRole.ADMIN)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get all users (Doctor/Admin only)' })
  @ApiResponse({ status: 200, description: 'Users list' })
  async getAllUsers(@Request() req: any) {
    return this.usersService.getAllUsers(req.user.role);
  }
}
