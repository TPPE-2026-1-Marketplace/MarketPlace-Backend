import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from './entities/person.entity';
import { PeopleController } from './people.controller';
import { PeopleService } from './people.service';

@Module({
  imports: [TypeOrmModule.forFeature([Person])],
  controllers: [PeopleController],
  providers: [PeopleService],
  // Exporta o service para que `auth` (D0) e `employees` (D2) consigam usá-lo.
  exports: [PeopleService],
})
export class PeopleModule {}
