import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleStatusDto } from './dto/update-sale-status.dto';
import { Prisma, User } from '@prisma/client';

const COMMISSION_RATE = 0.025; // 2.5%

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSaleDto, seller: User) {
    // Fetch all products and validate availability
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
      include: { inventory: true },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found or inactive');
    }

    // Validate stock for each item
    for (const item of dto.items) {
      const product = products.find((p) => p.id === item.productId)!;
      if (!product.inventory || product.inventory.quantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for product: ${product.name}`,
        );
      }
    }

    // Calculate totals
    const saleItems = dto.items.map((item) => {
      const product = products.find((p) => p.id === item.productId)!;
      const unitPrice = product.price;
      const subtotal = new Prisma.Decimal(Number(unitPrice) * item.quantity);
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        subtotal,
      };
    });

    const totalAmount = saleItems.reduce(
      (sum, i) => sum.add(i.subtotal),
      new Prisma.Decimal(0),
    );

    const commission = totalAmount.mul(COMMISSION_RATE);

    // Create sale + update inventory in a transaction
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.create({
        data: {
          sellerId: seller.id,
          totalAmount,
          commission,
          notes: dto.notes,
          items: {
            create: saleItems,
          },
        },
        include: {
          items: { include: { product: true } },
          seller: { select: { id: true, name: true, email: true } },
        },
      });

      // Decrease inventory for each item
      for (const item of dto.items) {
        await tx.inventory.update({
          where: { productId: item.productId },
          data: { quantity: { decrement: item.quantity } },
        });
      }

      return sale;
    });
  }

  async findAll(sellerId?: string) {
    return this.prisma.sale.findMany({
      where: sellerId ? { sellerId } : undefined,
      include: {
        items: { include: { product: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
    });

    if (!sale) {
      throw new NotFoundException(`Sale with id ${id} not found`);
    }

    return sale;
  }

  async updateStatus(id: string, dto: UpdateSaleStatusDto) {
    await this.findOne(id);

    return this.prisma.sale.update({
      where: { id },
      data: { status: dto.status },
      include: {
        items: { include: { product: true } },
        seller: { select: { id: true, name: true, email: true } },
      },
    });
  }

  calculateCommission(totalAmount: number): number {
    return totalAmount * COMMISSION_RATE;
  }
}
