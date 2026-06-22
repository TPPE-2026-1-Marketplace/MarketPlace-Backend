import * as crypto from 'crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, QueryFailedError, Repository } from 'typeorm';

import {
  BCRYPT_ROUNDS,
  EMPLOYEE_DEFAULT_COMMISSION_RATE,
  PG_UNIQUE_VIOLATION,
  TEMP_PASSWORD_BYTES,
} from '../common/constants';
import { CreateEmployeeDto } from './dtos/create-employee.dto';
import { QueryRankingDto } from './dtos/query-ranking.dto';
import { UpdateEmployeeDto } from './dtos/update-employee.dto';
import { Employee } from './entities/employee.entity';
import { Role } from '../common/enums/role.enum';
import { getMonthDateRange } from '../common/utils';
import { Order, OrderStatus, TipoRetirada } from '../orders/entities/order.entity';
import { OrdersService } from '../orders/orders.service';
import { Person } from '../people/entities/person.entity';
import { SalesGoalsService } from '../sales-goals/sales-goals.service';

@Injectable()
export class EmployeesService {
  constructor(
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly ordersService: OrdersService,
    private readonly salesGoalsService: SalesGoalsService,
  ) {}

  private stripPersonPassword(employee: Employee): Employee {
    if (employee.person) {
      const { senha: _ignored, ...personSafe } = employee.person;
      return { ...employee, person: personSafe as Employee['person'] };
    }
    return employee;
  }

  async create(dto: CreateEmployeeDto): Promise<Employee> {
    // eslint-disable-next-line complexity
    return this.dataSource.transaction(async (manager) => {
      const peopleRepository = manager.getRepository(Person);
      const employeesRepository = manager.getRepository(Employee);

      let person = await peopleRepository.findOne({
        where: { cpf: dto.cpf },
      });

      // Usa a senha fornecida ou gera uma temporária de 8 caracteres
      const senhaTemporaria = dto.senha || crypto.randomBytes(TEMP_PASSWORD_BYTES).toString('hex');
      const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
      const hashedSenha = await bcrypt.hash(senhaTemporaria, salt);

      if (person) {
        const existingEmployee = await employeesRepository.findOne({
          where: { cpf: dto.cpf },
        });

        if (existingEmployee) {
          throw new ConflictException('Funcionário já cadastrado com este CPF');
        }

        // Validação contra undefined para não apagar dados existentes acidentalmente
        if (dto.nome !== undefined) person.nome = dto.nome;
        if (dto.email !== undefined) person.email = dto.email;
        if (dto.telefone !== undefined) person.telefone = dto.telefone;

        person.senha = hashedSenha;

        person = await peopleRepository.save(person);
      } else {
        person = peopleRepository.create({
          cpf: dto.cpf,
          nome: dto.nome,
          email: dto.email,
          telefone: dto.telefone ?? null,
          senha: hashedSenha,
        });
        person = await peopleRepository.save(person);
      }

      const employee = employeesRepository.create({
        cpf: person.cpf,
        person: person,
        ativo: dto.ativo ?? true,
        role_perfil: dto.role_perfil,
        taxa_comissao: dto.taxa_comissao ?? EMPLOYEE_DEFAULT_COMMISSION_RATE,
        meta_vendas: dto.meta_vendas ?? null,
        codigo_funcionario: dto.codigo_funcionario ?? null,
      });

      try {
        const savedEmployee = await employeesRepository.save(employee);

        return {
          ...this.stripPersonPassword(savedEmployee),
          senha_temporaria: senhaTemporaria,
        };
      } catch (err) {
        if (
          err instanceof QueryFailedError &&
          (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
        ) {
          throw new ConflictException(
            'Email ou código de funcionário já em uso por outro registro',
          );
        }

        throw err;
      }
    });
  }

  async findAll(
    page: number,
    limit: number,
  ): Promise<{
    data: Employee[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const [rows, total] = await this.employeesRepository.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { cpf: 'ASC' },
    });

    return {
      data: rows.map((e) => this.stripPersonPassword(e)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async findOne(cpf: string): Promise<Employee> {
    const employee = await this.employeesRepository.findOne({
      where: { cpf },
    });

    if (!employee) {
      throw new NotFoundException(`Employee com CPF ${cpf} não encontrado`);
    }

    return this.stripPersonPassword(employee);
  }

  async update(cpf: string, dto: UpdateEmployeeDto): Promise<Employee> {
    // eslint-disable-next-line complexity
    return this.dataSource.transaction(async (manager) => {
      const peopleRepository = manager.getRepository(Person);
      const employeesRepository = manager.getRepository(Employee);

      const employee = await employeesRepository.findOne({ where: { cpf } });
      if (!employee) {
        throw new NotFoundException(`Employee com CPF ${cpf} não encontrado`);
      }

      const person = await peopleRepository.findOne({ where: { cpf } });
      if (!person) {
        throw new NotFoundException(`Person com CPF ${cpf} não encontrada`);
      }

      if (dto.nome !== undefined) person.nome = dto.nome;
      if (dto.email !== undefined) person.email = dto.email;
      if (dto.telefone !== undefined) person.telefone = dto.telefone ?? null;

      if (dto.senha !== undefined && dto.senha !== '') {
        const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
        person.senha = await bcrypt.hash(dto.senha, salt);
      }

      if (dto.ativo !== undefined) employee.ativo = dto.ativo;
      if (dto.role_perfil !== undefined) employee.role_perfil = dto.role_perfil;
      if (dto.taxa_comissao !== undefined) employee.taxa_comissao = dto.taxa_comissao;
      if (dto.meta_vendas !== undefined) employee.meta_vendas = dto.meta_vendas;
      if (dto.codigo_funcionario !== undefined)
        employee.codigo_funcionario = dto.codigo_funcionario;

      try {
        await peopleRepository.save(person);
        const updated = await employeesRepository.save(employee);
        return this.stripPersonPassword(updated);
      } catch (err) {
        if (
          err instanceof QueryFailedError &&
          (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
        ) {
          throw new ConflictException('Email ou código de funcionário já cadastrado');
        }

        throw err;
      }
    });
  }

  /**
   * Soma as vendas presenciais de um vendedor em um determinado mês e ano.
   * Retorna o total das vendas e a lista de pedidos correspondente.
   */
  async getSalesByEmployee(
    cpf: string,
    mes: number,
    ano: number,
  ): Promise<{ total: number; pedidos: Order[] }> {
    const pedidos = await this.ordersService.findInStoreOrdersByEmployeeAndPeriod(cpf, mes, ano);

    const totalRaw = pedidos.reduce((acc, order) => acc + Number(order.valorTotal), 0);
    const total = parseFloat(totalRaw.toFixed(2));

    return {
      total,
      pedidos,
    };
  }

  /**
   * Calcula a comissão automática de um vendedor no mês especificado.
   * Aplica comissão base de 2.5% (ou a cadastrada no vendedor) e
   * adiciona taxa bônus se a meta (individual ou coletiva) for atingida.
   */
  async calculateCommission(
    cpf: string,
    mes: number,
    ano: number,
  ): Promise<{ total_vendas: number; comissao: number; meta_batida: boolean }> {
    const employee = await this.employeesRepository.findOne({
      where: { cpf },
    });

    if (!employee) {
      throw new NotFoundException(`Funcionário com CPF "${cpf}" não encontrado.`);
    }

    // 1. Obter total de vendas presenciais no período
    const { total: total_vendas } = await this.getSalesByEmployee(cpf, mes, ano);

    // 2. Buscar meta individual do vendedor no período
    let goal = await this.salesGoalsService.findGoalByPeriod(cpf, mes, ano);

    // 3. Se não houver meta individual, buscar meta coletiva
    if (!goal) {
      goal = await this.salesGoalsService.findGoalByPeriod(null, mes, ano);
    }

    let meta_batida = false;
    let valorBonus = 0;

    if (goal) {
      meta_batida = total_vendas >= Number(goal.valorMeta);
      if (meta_batida) {
        valorBonus = Number(goal.valorBonus ?? 0);
      }
    }

    // 4. Calcular comissão: taxa base sobre vendas + bônus fixo
    const taxaBase = Number(employee.taxa_comissao);
    const comissaoBase = total_vendas * taxaBase;
    const comissaoTotalRaw = comissaoBase + valorBonus;
    const comissao = parseFloat(comissaoTotalRaw.toFixed(2));

    return {
      total_vendas,
      comissao,
      meta_batida,
    };
  }

  /**
   * Obtém o relatório detalhado de comissões e vendas do funcionário no mês e ano.
   */
  async getCommissionReport(cpf: string, mes: number, ano: number) {
    const { total_vendas, comissao, meta_batida } = await this.calculateCommission(cpf, mes, ano);
    const { pedidos } = await this.getSalesByEmployee(cpf, mes, ano);

    const goal =
      (await this.salesGoalsService.findGoalByPeriod(cpf, mes, ano)) ||
      (await this.salesGoalsService.findGoalByPeriod(null, mes, ano));

    return {
      total_vendas,
      comissao,
      meta_batida,
      pedidos,
      meta_vendas: goal ? Number(goal.valorMeta) : 0,
      valor_bonus: goal ? Number(goal.valorBonus ?? 0) : 0,
    };
  }

  /**
   * Retorna o ranking mensal dos vendedores ordenado por total de vendas decrescente (Administrador, Vendedor, Caixa, Gerente).
   */
  async getSellersRanking(
    query: QueryRankingDto,
  ): Promise<
    Array<{ nome: string; codigo_funcionario: string; total_vendas: number; posicao: number }>
  > {
    const now = new Date();
    const mes = query.mes ?? now.getMonth() + 1;
    const ano = query.ano ?? now.getFullYear();

    const { startDate, endDate } = getMonthDateRange(ano, mes);

    const rawRanking = await this.employeesRepository
      .createQueryBuilder('employee')
      .innerJoin('employee.person', 'person')
      .leftJoin(
        Order,
        'order',
        'order.idFuncionario = employee.cpf AND order.tipoRetirada = :tipoRetirada AND order.status IN (:...statuses) AND order.dataPedido BETWEEN :start AND :end',
        {
          tipoRetirada: TipoRetirada.LOJA,
          statuses: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
          start: startDate,
          end: endDate,
        },
      )
      .select([
        'person.nome AS nome',
        'employee.codigo_funcionario AS codigo_funcionario',
        'COALESCE(SUM(order.valorTotal), 0) AS total_vendas',
      ])
      .where('employee.role_perfil = :role', { role: Role.VENDEDOR })
      .groupBy('employee.cpf')
      .addGroupBy('person.cpf')
      .addGroupBy('person.nome')
      .addGroupBy('employee.codigo_funcionario')
      .getRawMany();

    const ranking = rawRanking.map((raw) => ({
      nome: raw.nome || '',
      codigo_funcionario: raw.codigo_funcionario || '',
      total_vendas: parseFloat(Number(raw.total_vendas).toFixed(2)),
    }));

    // Ordenar por valor total de vendas DESC
    ranking.sort((a, b) => b.total_vendas - a.total_vendas);

    // Mapear incluindo a posição (1-based index)
    return ranking.map((entry, index) => ({
      ...entry,
      posicao: index + 1,
    }));
  }
}
