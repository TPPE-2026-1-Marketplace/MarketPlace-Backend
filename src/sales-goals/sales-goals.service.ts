import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';

import { CreateSalesGoalDto } from './dtos/create-sales-goal.dto';
import { QueryProgressDto } from './dtos/query-progress.dto';
import { QuerySalesGoalDto } from './dtos/query-sales-goal.dto';
import { UpdateSalesGoalDto } from './dtos/update-sales-goal.dto';
import { SalesGoal } from './entities/sales-goal.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Order, OrderStatus, TipoRetirada } from '../orders/entities/order.entity';
import { OrdersService } from '../orders/orders.service';

@Injectable()
export class SalesGoalsService {
  constructor(
    @InjectRepository(SalesGoal)
    private readonly salesGoalsRepository: Repository<SalesGoal>,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private readonly ordersService: OrdersService,
  ) {}

  /**
   * Cadastra uma nova meta mensal individual ou coletiva (Administrador).
   * Valida a existência do funcionário se o CPF for informado, e garante a unicidade da meta no período.
   */
  async create(dto: CreateSalesGoalDto): Promise<SalesGoal> {
    // 1. Validar se o funcionário existe caso o CPF seja informado
    if (dto.cpfFuncionario) {
      const employee = await this.employeeRepository.findOne({
        where: { cpf: dto.cpfFuncionario },
      });

      if (!employee) {
        throw new NotFoundException(
          `Funcionário com CPF "${dto.cpfFuncionario}" não foi encontrado.`,
        );
      }
    }

    // 2. Validar a unicidade da meta (Unique Constraint: cpfFuncionario, mes, ano)
    const existingGoal = await this.salesGoalsRepository.findOne({
      where: {
        cpfFuncionario: dto.cpfFuncionario ?? IsNull(),
        mes: dto.mes,
        ano: dto.ano,
      },
    });

    if (existingGoal) {
      throw new ConflictException(
        dto.cpfFuncionario
          ? `Já existe uma meta cadastrada para o funcionário com CPF "${dto.cpfFuncionario}" no mês ${dto.mes}/${dto.ano}.`
          : `Já existe uma meta coletiva cadastrada para o mês ${dto.mes}/${dto.ano}.`,
      );
    }

    // 3. Criar e persistir a meta
    const goal = this.salesGoalsRepository.create({
      cpfFuncionario: dto.cpfFuncionario ?? null,
      mes: dto.mes,
      ano: dto.ano,
      valorMeta: dto.valorMeta,
      taxaComissaoBonus: dto.taxaComissaoBonus ?? null,
    });

    return await this.salesGoalsRepository.save(goal);
  }

  /**
   * Retorna as metas filtradas por mês e ano (Administrador).
   */
  async findAll(query: QuerySalesGoalDto): Promise<SalesGoal[]> {
    const where: any = {};
    if (query.mes !== undefined) {
      where.mes = query.mes;
    }
    if (query.ano !== undefined) {
      where.ano = query.ano;
    }
    return await this.salesGoalsRepository.find({
      where,
      relations: ['employee', 'employee.person'],
    });
  }

  /**
   * Retorna uma única meta pelo ID ou lança erro se não encontrada.
   */
  async findOne(id: number): Promise<SalesGoal> {
    const goal = await this.salesGoalsRepository.findOne({
      where: { idGoal: id },
      relations: ['employee', 'employee.person'],
    });

    if (!goal) {
      throw new NotFoundException(`Meta com ID ${id} não foi encontrada.`);
    }

    return goal;
  }

  /**
   * Atualiza uma meta existente (Administrador).
   * Valida funcionário inexistente e previne duplicações de período.
   */
  async update(id: number, dto: UpdateSalesGoalDto): Promise<SalesGoal> {
    const goal = await this.findOne(id);

    // 1. Validar se o funcionário existe caso o CPF seja atualizado
    if (dto.cpfFuncionario !== undefined) {
      if (dto.cpfFuncionario !== null) {
        const employee = await this.employeeRepository.findOne({
          where: { cpf: dto.cpfFuncionario },
        });

        if (!employee) {
          throw new NotFoundException(
            `Funcionário com CPF "${dto.cpfFuncionario}" não foi encontrado.`,
          );
        }
      }
    }

    // 2. Validar a unicidade da meta caso cpfFuncionario, mes ou ano estejam sendo alterados
    const cpfFuncionario =
      dto.cpfFuncionario !== undefined ? dto.cpfFuncionario : goal.cpfFuncionario;
    const mes = dto.mes !== undefined ? dto.mes : goal.mes;
    const ano = dto.ano !== undefined ? dto.ano : goal.ano;

    if (dto.cpfFuncionario !== undefined || dto.mes !== undefined || dto.ano !== undefined) {
      const existingGoal = await this.salesGoalsRepository.findOne({
        where: {
          idGoal: Not(id),
          cpfFuncionario: cpfFuncionario ?? IsNull(),
          mes,
          ano,
        },
      });

      if (existingGoal) {
        throw new ConflictException(
          cpfFuncionario
            ? `Já existe uma meta cadastrada para o funcionário com CPF "${cpfFuncionario}" no mês ${mes}/${ano}.`
            : `Já existe uma meta coletiva cadastrada para o mês ${mes}/${ano}.`,
        );
      }
    }

    // 3. Atualizar e salvar
    if (dto.cpfFuncionario !== undefined) {
      goal.cpfFuncionario = dto.cpfFuncionario;
    }
    if (dto.mes !== undefined) {
      goal.mes = dto.mes;
    }
    if (dto.ano !== undefined) {
      goal.ano = dto.ano;
    }
    if (dto.valorMeta !== undefined) {
      goal.valorMeta = dto.valorMeta;
    }
    if (dto.taxaComissaoBonus !== undefined) {
      goal.taxaComissaoBonus = dto.taxaComissaoBonus;
    }

    return await this.salesGoalsRepository.save(goal);
  }

  /**
   * Exclui uma meta existente pelo ID (Administrador).
   */
  async remove(id: number): Promise<void> {
    const goal = await this.findOne(id);
    await this.salesGoalsRepository.remove(goal);
  }

  /**
   * Busca a meta cadastrada para um funcionário no período especificado.
   * Se cpfFuncionario for null, busca a meta coletiva.
   */
  async findGoalByPeriod(
    cpfFuncionario: string | null,
    mes: number,
    ano: number,
  ): Promise<SalesGoal | null> {
    return await this.salesGoalsRepository.findOne({
      where: {
        cpfFuncionario: cpfFuncionario ?? IsNull(),
        mes,
        ano,
      },
    });
  }

  /**
   * Retorna o progresso das metas individuais no mês e ano especificados.
   */
  async getIndividualProgress(query: QueryProgressDto): Promise<
    Array<{
      funcionario: { cpf: string; nome: string; codigo_funcionario: string };
      meta: number;
      realizado: number;
      percentual: number;
    }>
  > {
    const now = new Date();
    const mes = query.mes ?? now.getMonth() + 1;
    const ano = query.ano ?? now.getFullYear();

    const startDate = new Date(ano, mes - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(ano, mes, 0, 23, 59, 59, 999);

    const rawProgress = await this.salesGoalsRepository
      .createQueryBuilder('goal')
      .innerJoin('goal.employee', 'employee')
      .innerJoin('employee.person', 'person')
      .leftJoin(
        Order,
        'order',
        'order.idFuncionario = goal.cpfFuncionario AND order.tipoRetirada = :tipoRetirada AND order.status IN (:...statuses) AND order.dataPedido BETWEEN :start AND :end',
        {
          tipoRetirada: TipoRetirada.LOJA,
          statuses: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
          start: startDate,
          end: endDate,
        },
      )
      .select([
        'employee.cpf AS cpf',
        'person.nome AS nome',
        'employee.codigo_funcionario AS codigo_funcionario',
        'goal.valorMeta AS meta',
        'COALESCE(SUM(order.valorTotal), 0) AS realizado',
      ])
      .where('goal.cpfFuncionario IS NOT NULL')
      .andWhere('goal.mes = :mes', { mes })
      .andWhere('goal.ano = :ano', { ano })
      .groupBy('goal.idGoal')
      .addGroupBy('employee.cpf')
      .addGroupBy('person.cpf')
      .addGroupBy('person.nome')
      .addGroupBy('employee.codigo_funcionario')
      .getRawMany();

    return rawProgress.map((raw) => {
      const meta = parseFloat(Number(raw.meta).toFixed(2));
      const realizado = parseFloat(Number(raw.realizado).toFixed(2));
      const percentual = meta > 0 ? parseFloat(((realizado / meta) * 100).toFixed(2)) : 0;

      return {
        funcionario: {
          cpf: raw.cpf || '',
          nome: raw.nome || '',
          codigo_funcionario: raw.codigo_funcionario || '',
        },
        meta,
        realizado,
        percentual,
      };
    });
  }

  /**
   * Retorna o progresso da meta coletiva (equipe) no mês e ano especificados.
   */
  async getTeamProgress(
    query: QueryProgressDto,
  ): Promise<{ meta: number; realizado: number; percentual: number }> {
    const now = new Date();
    const mes = query.mes ?? now.getMonth() + 1;
    const ano = query.ano ?? now.getFullYear();

    const goal = await this.findGoalByPeriod(null, mes, ano);

    if (!goal) {
      throw new NotFoundException(`Nenhuma meta coletiva cadastrada para o período ${mes}/${ano}.`);
    }

    const realizado = await this.ordersService.sumTotalInStoreSalesByPeriod(mes, ano);
    const meta = Number(goal.valorMeta);
    const percentual = meta > 0 ? parseFloat(((realizado / meta) * 100).toFixed(2)) : 0;

    return {
      meta,
      realizado,
      percentual,
    };
  }
}
