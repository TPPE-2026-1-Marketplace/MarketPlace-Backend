import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { Employee } from './entities/employee.entity';
import { OrdersModule } from '../orders/orders.module';
import { SalesGoalsModule } from '../sales-goals/sales-goals.module';

@Module({
  imports: [TypeOrmModule.forFeature([Employee]), OrdersModule, SalesGoalsModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
