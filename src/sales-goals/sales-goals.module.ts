import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SalesGoal } from './entities/sales-goal.entity';
import { SalesGoalsController } from './sales-goals.controller';
import { SalesGoalsService } from './sales-goals.service';
import { Employee } from '../employees/entities/employee.entity';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [TypeOrmModule.forFeature([SalesGoal, Employee]), OrdersModule],
  controllers: [SalesGoalsController],
  providers: [SalesGoalsService],
  exports: [SalesGoalsService],
})
export class SalesGoalsModule {}
