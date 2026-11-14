import { createHash, randomBytes } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { DataSource, IsNull, Repository } from 'typeorm';

import {
  ANONYMIZED_EMAIL_DOMAIN,
  BCRYPT_ROUNDS,
  PASSWORD_RESET_TOKEN_BYTES,
  PASSWORD_RESET_TOKEN_TTL_MINUTES,
  PASSWORD_RESET_TOKEN_TTL_MS,
} from '../common/constants';
import { Role } from '../common/enums/role.enum';
import { maskEmail } from '../common/utils';
import { Employee } from '../employees/entities/employee.entity';
import { MailService } from '../mail/mail.service';
import { buildPasswordResetEmail } from '../mail/templates/password-reset.template';
import { Person } from '../people/entities/person.entity';
import { PeopleService } from '../people/people.service';
import { LoginDto } from './dtos/login.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { PasswordResetToken } from './entities/password-reset-token.entity';

/** Resposta única do "esqueci minha senha": não revela se o e-mail tem conta. */
export const FORGOT_PASSWORD_MESSAGE =
  'Se o e-mail estiver cadastrado, você receberá um link para redefinir a senha.';
export const RESET_PASSWORD_MESSAGE = 'Senha redefinida. Faça login com a nova senha.';
const INVALID_RESET_LINK = 'Link de redefinição inválido ou expirado. Peça um novo.';
const DEFAULT_FRONTEND_URL = 'http://localhost:3000';

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly peopleService: PeopleService,
    @InjectRepository(Employee)
    private readonly employeeRepository: Repository<Employee>,
    private readonly jwtService: JwtService,
    @InjectRepository(PasswordResetToken)
    private readonly resetTokenRepository: Repository<PasswordResetToken>,
    private readonly mailService: MailService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async login(dto: LoginDto): Promise<{ access_token: string }> {
    const person = await this.peopleService.findByEmailWithPassword(dto.email);

    if (!person) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    if (!person.senha) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    const isPasswordValid = await bcrypt.compare(dto.senha, person.senha);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }

    const employee = await this.employeeRepository.findOne({
      where: { cpf: person.cpf },
    });

    const role = employee ? employee.role_perfil : Role.CLIENTE;

    const access_token = this.jwtService.sign({
      sub: person.cpf,
      email: person.email,
      role,
    });

    return { access_token };
  }

  /**
   * "Esqueci minha senha" (issue #250). Responde sempre a mesma mensagem e
   * dispara a geração do token e o e-mail fora do caminho da resposta, para
   * que nem o conteúdo nem o tempo de resposta revelem se o e-mail tem conta.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    if (!this.mailService.isEnabled()) {
      throw new ServiceUnavailableException(
        'Recuperação de senha indisponível no momento. Fale com a loja.',
      );
    }

    const person = await this.peopleService.findByEmailWithPassword(email);
    if (person && !person.email.endsWith(`@${ANONYMIZED_EMAIL_DOMAIN}`)) {
      this.sendResetLink(person).catch((error: unknown) =>
        this.logger.warn(
          `Falha ao enviar o link de redefinição para ${maskEmail(person.email)}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );
    }

    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  /**
   * Troca a senha a partir do link do e-mail. O token precisa existir, não ter
   * sido usado e estar no prazo; depois do uso, todos os links pendentes da
   * pessoa deixam de valer.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const tokenHash = hashResetToken(dto.token);

    await this.dataSource.transaction(async (manager) => {
      const tokens = manager.getRepository(PasswordResetToken);
      const token = await tokens.findOne({
        where: { tokenHash },
        lock: { mode: 'pessimistic_write' },
      });

      if (!token || token.usadoEm || token.expiraEm.getTime() <= Date.now()) {
        throw new BadRequestException(INVALID_RESET_LINK);
      }

      const senha = await bcrypt.hash(dto.novaSenha, BCRYPT_ROUNDS);
      await manager.getRepository(Person).update({ cpf: token.cpf }, { senha });

      token.usadoEm = new Date();
      await tokens.save(token);
      await tokens.delete({ cpf: token.cpf, usadoEm: IsNull() });
    });

    return { message: RESET_PASSWORD_MESSAGE };
  }

  /** Gera um token novo (invalidando os pendentes) e envia o link por e-mail. */
  private async sendResetLink(person: Person): Promise<void> {
    const token = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString('base64url');

    await this.resetTokenRepository.delete({ cpf: person.cpf, usadoEm: IsNull() });
    await this.resetTokenRepository.save(
      this.resetTokenRepository.create({
        cpf: person.cpf,
        tokenHash: hashResetToken(token),
        expiraEm: new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS),
        usadoEm: null,
      }),
    );

    const frontendUrl = (process.env.FRONTEND_URL || DEFAULT_FRONTEND_URL).replace(/\/+$/, '');
    await this.mailService.send(
      buildPasswordResetEmail({
        to: person.email,
        nome: person.nome,
        link: `${frontendUrl}/redefinir-senha?token=${token}`,
        validadeMinutos: PASSWORD_RESET_TOKEN_TTL_MINUTES,
      }),
    );

    this.logger.log(`Link de redefinição de senha enviado para ${maskEmail(person.email)}.`);
  }
}
