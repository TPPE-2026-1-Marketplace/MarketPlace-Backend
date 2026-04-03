import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashed,
        role: dto.role,
      },
      select: USER_SELECT,
    });
  }

  async findAll() {
    return this.prisma.user.findMany({ select: USER_SELECT });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException(`User with id ${id} not found`);
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findOne(id);

    if (dto.email) {
      const existing = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
      });
      if (existing) {
        throw new ConflictException('Email already in use');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    return this.prisma.user.delete({
      where: { id },
      select: USER_SELECT,
    });
  }
}
