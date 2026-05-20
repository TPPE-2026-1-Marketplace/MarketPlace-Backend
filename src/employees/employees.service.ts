import {
	ConflictException,
	Injectable,
	NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Employee } from './entities/employee.entity';
import { CreateEmployeeDto } from './dtos/create-employee.dto';
import { Person } from '../people/entities/person.entity';

const PG_UNIQUE_VIOLATION = '23505';

@Injectable()
export class EmployeesService {
	constructor(
		@InjectRepository(Employee)
		private readonly employeesRepository: Repository<Employee>,
		@InjectRepository(Person)
		private readonly peopleRepository: Repository<Person>,
	) {}

	async create(dto: CreateEmployeeDto): Promise<Employee> {
		const person = await this.peopleRepository.findOne({
			where: { cpf: dto.cpf },
		});

		if (!person) {
			throw new NotFoundException(`Pessoa com CPF ${dto.cpf} não encontrada`);
		}

		const existingEmployee = await this.employeesRepository.findOne({
			where: { cpf: dto.cpf },
		});

		if (existingEmployee) {
			throw new ConflictException(`Employee com CPF ${dto.cpf} já existe`);
		}

		const employee = this.employeesRepository.create({
			cpf: dto.cpf,
			person,
			ativo: dto.ativo ?? true,
			role_perfil: dto.role_perfil,
			taxa_comissao: dto.taxa_comissao ?? 0.025,
			meta_vendas: dto.meta_vendas ?? null,
			codigo_funcionario: dto.codigo_funcionario ?? null,
		});

		try {
			return await this.employeesRepository.save(employee);
		} catch (err) {
			if (
				err instanceof QueryFailedError &&
				(err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
			) {
				throw new ConflictException('Employee já cadastrado');
			}

			throw err;
		}
	}
}
