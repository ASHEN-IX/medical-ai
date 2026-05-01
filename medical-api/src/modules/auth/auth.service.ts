import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from '@prisma/client';

export interface AuthToken {
  access_token: string;
  user: Partial<User>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthToken> {
    const { name, email, password, role, age, gender, medicalBackground, specialty, licenseNo } = registerDto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userRole = role === 'DOCTOR' ? 'DOCTOR' : 'PATIENT';

    const user = await this.prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userRole,
        age: age || null,
        gender: gender as any || null,
        medicalBackground: medicalBackground || null,
      },
    });

    if (userRole === 'DOCTOR' && specialty) {
      await this.prisma.doctorProfile.create({
        data: {
          userId: user.id,
          specialty,
          licenseNo: licenseNo || null,
          verified: false,
        },
      });
    }

    this.logger.log(`New ${userRole} registered: ${email}`);

    const accessToken = this.generateToken(user.id, user.email);

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        age: user.age,
        gender: user.gender,
      },
    };
  }

  async login(loginDto: LoginDto): Promise<AuthToken> {
    const { email, password } = loginDto;

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { doctorProfile: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`User logged in: ${email}`);

    const accessToken = this.generateToken(user.id, user.email);

    return {
      access_token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        age: user.age,
        gender: user.gender,
      },
    };
  }

  async validateUser(userId: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id: userId },
    });
  }

  async refresh(token: string): Promise<AuthToken> {
    try {
      const decoded = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET || 'your-secret-key-change-in-prod',
      }) as { sub: string; email: string };

      const user = await this.validateUser(decoded.sub);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const newAccessToken = this.generateToken(user.id, user.email);
      return {
        access_token: newAccessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private generateToken(userId: string, email: string): string {
    return this.jwtService.sign(
      { sub: userId, email },
      {
        secret: process.env.JWT_SECRET || 'your-secret-key-change-in-prod',
        expiresIn: '24h',
      },
    );
  }
}
