import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUserById(id: string): Promise<Partial<User> & { doctorProfile?: any }> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        age: true,
        gender: true,
        medicalBackground: true,
        createdAt: true,
        updatedAt: true,
        doctorProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async getMe(userId: string) {
    return this.getUserById(userId);
  }

  async updateUser(
    userId: string,
    updateUserDto: UpdateUserDto,
  ) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateUserDto as any,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        age: true,
        gender: true,
        medicalBackground: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    this.logger.log(`User ${userId} updated`);
    return user;
  }

  async getAllUsers(requesterRole: UserRole) {
    if (requesterRole !== UserRole.DOCTOR && requesterRole !== UserRole.ADMIN) {
      throw new ForbiddenException('Only doctors and admins can view all users');
    }

    return this.prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        age: true,
        gender: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getUsersByRole(role: UserRole) {
    return this.prisma.user.findMany({
      where: { role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        age: true,
        gender: true,
        createdAt: true,
        updatedAt: true,
        doctorProfile: role === UserRole.DOCTOR ? true : undefined,
      },
    });
  }

  async getDoctors() {
    return this.prisma.user.findMany({
      where: { role: UserRole.DOCTOR },
      select: {
        id: true,
        name: true,
        email: true,
        doctorProfile: {
          select: {
            specialty: true,
            verified: true,
            bio: true,
          },
        },
      },
    });
  }
}
