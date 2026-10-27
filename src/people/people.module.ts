import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AddressesModule } from '../addresses/addresses.module';
import { Person } from './entities/person.entity';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';
import { Employee } from '../employees/entities/employee.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Person, Employee]), AddressesModule],
  controllers: [PeopleController],
  providers: [PeopleService],
  exports: [PeopleService],
})
export class PeopleModule {}
