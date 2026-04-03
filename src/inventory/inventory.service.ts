import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { AuditAction, Role, User } from '@prisma/client';

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.inventory.findMany({
      include: {
        product: {
          select: { id: true, name: true, sku: true, category: true },
        },
      },
    });
  }

  async findByProduct(productId: string) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
      include: {
        product: true,
        auditLogs: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!inventory) {
      throw new NotFoundException(
        `Inventory for product ${productId} not found`,
      );
    }

    return inventory;
  }

  async adjustStock(productId: string, dto: AdjustStockDto, currentUser: User) {
    if (currentUser.role !== Role.MANAGER && currentUser.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Only managers and admins can adjust stock manually',
      );
    }

    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
    });

    if (!inventory) {
      throw new NotFoundException(
        `Inventory for product ${productId} not found`,
      );
    }

    const [updatedInventory] = await this.prisma.$transaction([
      this.prisma.inventory.update({
        where: { productId },
        data: { quantity: dto.quantity },
        include: { product: { select: { id: true, name: true, sku: true } } },
      }),
      this.prisma.auditLog.create({
        data: {
          userId: currentUser.id,
          inventoryId: inventory.id,
          action: AuditAction.STOCK_ADJUSTMENT,
          oldQuantity: inventory.quantity,
          newQuantity: dto.quantity,
          reason: dto.reason,
        },
      }),
    ]);

    return updatedInventory;
  }

  async getAuditLogs(inventoryId?: string) {
    return this.prisma.auditLog.findMany({
      where: inventoryId ? { inventoryId } : undefined,
      include: {
        user: { select: { id: true, name: true, email: true } },
        inventory: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
