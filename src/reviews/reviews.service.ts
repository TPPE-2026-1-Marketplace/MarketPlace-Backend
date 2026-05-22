import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import { DataSource, EntityManager, QueryFailedError, Repository } from "typeorm";
import { CreateReviewDto } from "./dtos/create-review.dto";
import { Review } from "./entities/review.entity";
import { Person } from "../people/entities/person.entity";
import { Product } from "../products/entities/product.entity";
import { Order, OrderStatus } from "../orders/entities/order.entity";

const PG_UNIQUE_VIOLATION = "23505";

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    @InjectRepository(Review)
    private readonly reviewsRepository: Repository<Review>,
    @InjectRepository(Person)
    private readonly peopleRepository: Repository<Person>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Cria uma nova avaliação de produto por um cliente.
   *
   * Regras de negócio:
   * - O cliente (idCliente capturado do token) deve existir no banco.
   * - O produto (Product) deve existir no banco.
   * - O cliente só pode avaliar cada produto uma única vez.
   * - Lança ConflictException (409) se já existir uma avaliação.
   */
  async create(idCliente: string, dto: CreateReviewDto): Promise<Review> {
    return await this.dataSource.transaction(async (manager) => {
      const peopleRepo = manager.getRepository(Person);
      const productsRepo = manager.getRepository(Product);
      const ordersRepo = manager.getRepository(Order);
      const reviewsRepo = manager.getRepository(Review);

      // 1. Validar se o cliente existe
      const clientExists = await peopleRepo.findOne({
        where: { cpf: idCliente },
      });
      if (!clientExists) {
        throw new NotFoundException(
          `Cliente com CPF ${idCliente} não encontrado`,
        );
      }

      // 2. Validar se o produto existe
      const productExists = await productsRepo.findOne({
        where: { idProduto: dto.idProduto },
      });
      if (!productExists) {
        throw new NotFoundException(
          `Produto com ID ${dto.idProduto} não encontrado`,
        );
      }

      // 2.5 Validar se o cliente de fato comprou o produto (Compra Verificada)
      const hasPurchased = await ordersRepo
        .createQueryBuilder("order")
        .innerJoin("order.items", "item")
        .innerJoin("item.variant", "variant")
        .innerJoin("variant.product", "product")
        .where("order.idUsuario = :idCliente", { idCliente })
        .andWhere("product.idProduto = :idProduto", { idProduto: dto.idProduto })
        .andWhere("order.status IN (:...statuses)", {
          statuses: [
            OrderStatus.PAID,
            OrderStatus.SHIPPED,
            OrderStatus.DELIVERED,
          ],
        })
        .getCount();

      if (hasPurchased === 0) {
        throw new ForbiddenException(
          "Apenas clientes que compraram e pagaram pelo produto podem avaliá-lo.",
        );
      }

      // 3. Validar se o cliente já avaliou este produto (Verificação prévia)
      const existingReview = await reviewsRepo.findOne({
        where: {
          idCliente,
          idProduto: dto.idProduto,
        },
      });
      if (existingReview) {
        throw new ConflictException("O cliente já avaliou este produto");
      }

      // Sanitização do comentário para evitar XSS
      let sanitizedComment: string | null = null;
      if (dto.comentario) {
        sanitizedComment = dto.comentario.replace(/<[^>]*>/g, "").trim();
        if (sanitizedComment.length === 0) {
          sanitizedComment = null;
        }
      }

      // 4. Instanciar e salvar a avaliação
      const review = reviewsRepo.create({
        idCliente,
        idProduto: dto.idProduto,
        nota: dto.nota,
        comentario: sanitizedComment,
      });

      try {
        const savedReview = await reviewsRepo.save(review);
        await this.updateProductStatsTransactional(manager, dto.idProduto);
        return savedReview;
      } catch (err) {
        if (
          err instanceof QueryFailedError &&
          (err.driverError as { code?: string })?.code === PG_UNIQUE_VIOLATION
        ) {
          throw new ConflictException("O cliente já avaliou este produto");
        }
        throw err;
      }
    });
  }

  /**
   * Busca todas as avaliações de um produto.
   */
  async findByProduct(idProduto: number): Promise<Review[]> {
    const productExists = await this.productsRepository.findOne({
      where: { idProduto },
    });
    if (!productExists) {
      throw new NotFoundException(`Produto com ID ${idProduto} não encontrado`);
    }

    return this.reviewsRepository.find({
      where: { idProduto },
      relations: { cliente: true },
      order: { dataAvaliacao: "DESC" },
    });
  }

  /**
   * Busca todas as avaliações de um produto com paginação, média e total geral.
   *
   * Requisitos:
   * - Público
   * - Paginação (padrão 10 itens)
   * - Ordenado por data desc
   * - Retorna média e contagem total de avaliações do produto
   * - NUNCA expõe o CPF do cliente
   * - Inclui o histograma de distribuição das estrelas
   */
  async findByProductPaginated(
    idProduto: number,
    page: number,
    limit: number,
  ): Promise<{
    data: {
      idProduto: number;
      nota: number;
      comentario: string | null;
      dataAvaliacao: Date;
      cliente: { nome: string };
    }[];
    meta: { page: number; limit: number; total: number; totalPages: number };
    media: number;
    totalAvaliacoes: number;
    distribuicao: {
      "1": number;
      "2": number;
      "3": number;
      "4": number;
      "5": number;
    };
  }> {
    // 1. Validar se o produto existe e carregar dados denormalizados
    const product = await this.productsRepository.findOne({
      where: { idProduto },
    });
    if (!product) {
      throw new NotFoundException(`Produto com ID ${idProduto} não encontrado`);
    }

    // 2. Buscar avaliações paginadas ordenadas por data desc
    const [reviews, total] = await this.reviewsRepository.findAndCount({
      where: { idProduto },
      relations: { cliente: true },
      order: { dataAvaliacao: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    });

    // 3. Obter distribuição de estrelas (de 1 a 5)
    const distributionRaw = await this.reviewsRepository
      .createQueryBuilder("review")
      .select("review.nota", "nota")
      .addSelect("COUNT(*)", "count")
      .where("review.idProduto = :idProduto", { idProduto })
      .groupBy("review.nota")
      .getRawMany();

    const distribuicao = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
    distributionRaw.forEach((row) => {
      distribuicao[row.nota.toString()] = Number(row.count);
    });

    const media = product.mediaAvaliacao
      ? Number(Number(product.mediaAvaliacao).toFixed(1))
      : 0;
    const totalAvaliacoes = product.totalAvaliacoes
      ? Number(product.totalAvaliacoes)
      : 0;

    // 4. Mapear resposta para esconder CPF do cliente e incluir apenas o nome
    const safeData = reviews.map((r) => ({
      idProduto: r.idProduto,
      nota: r.nota,
      comentario: r.comentario,
      dataAvaliacao: r.dataAvaliacao,
      cliente: {
        nome: r.cliente?.nome || "Cliente Anônimo",
      },
    }));

    return {
      data: safeData,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
      media,
      totalAvaliacoes,
      distribuicao,
    };
  }

  /**
   * Remove uma avaliação de produto (hard delete).
   * Exclusivo para gerentes e administradores.
   */
  async remove(idCliente: string, idProduto: number): Promise<void> {
    return await this.dataSource.transaction(async (manager) => {
      const reviewsRepo = manager.getRepository(Review);

      const review = await reviewsRepo.findOne({
        where: { idCliente, idProduto },
      });
      if (!review) {
        throw new NotFoundException(
          `Avaliação do cliente ${idCliente} para o produto ID ${idProduto} não encontrada`,
        );
      }

      await reviewsRepo.remove(review);
      await this.updateProductStatsTransactional(manager, idProduto);
      this.logger.log(
        `Avaliação do produto ID ${idProduto} pelo cliente CPF ${idCliente} foi excluída com sucesso (Hard Delete).`,
      );
    });
  }

  /**
   * Recalcula a média e contagem de avaliações de forma concorrencial segura (Pessimistic Locking)
   * e atualiza na tabela de produtos dentro de uma transação.
   */
  private async updateProductStatsTransactional(
    manager: EntityManager,
    idProduto: number,
  ): Promise<void> {
    // 1. Obter bloqueio pessimista de escrita (SELECT FOR UPDATE) na linha correspondente do produto
    const product = await manager.findOne(Product, {
      where: { idProduto },
      lock: { mode: "pessimistic_write" },
    });

    if (!product) {
      throw new NotFoundException(`Produto com ID ${idProduto} não encontrado`);
    }

    // 2. Calcular a média e o total atualizado
    const { avg, count } = await manager
      .getRepository(Review)
      .createQueryBuilder("review")
      .select("AVG(review.nota)", "avg")
      .addSelect("COUNT(*)", "count")
      .where("review.idProduto = :idProduto", { idProduto })
      .getRawOne();

    const media = avg ? Number(Number(avg).toFixed(2)) : 0.0;
    const total = count ? Number(count) : 0;

    // 3. Atualizar e salvar o produto com as novas estatísticas de forma persistente
    product.mediaAvaliacao = media;
    product.totalAvaliacoes = total;
    await manager.save(product);
  }
}
