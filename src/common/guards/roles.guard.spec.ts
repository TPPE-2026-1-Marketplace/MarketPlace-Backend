import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

import type { ExecutionContext } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector) as jest.Mocked<Reflector>;
  });

  describe('Comportamento geral', () => {
    it('deve estar definido', () => {
      expect(guard).toBeDefined();
    });

    it('deve implementar CanActivate', () => {
      expect(guard.canActivate).toBeDefined();
      expect(typeof guard.canActivate).toBe('function');
    });
  });

  describe('Sem @Roles() decorator', () => {
    it('deve permitir qualquer usuário autenticado quando sem @Roles()', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.CLIENTE },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('deve permitir qualquer role quando @Roles() não está definido', () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);

      const testCases = [Role.CLIENTE, Role.CAIXA, Role.VENDEDOR, Role.GERENTE, Role.ADMINISTRADOR];

      testCases.forEach((role) => {
        const mockExecutionContext = {
          switchToHttp: () => ({
            getRequest: () => ({
              user: { role },
            }),
          }),
          getHandler: () => ({}),
          getClass: () => ({}),
        } as unknown as ExecutionContext;

        const result = guard.canActivate(mockExecutionContext);
        expect(result).toBe(true);
      });
    });
  });

  describe('Critério de aceite: 403 com role inadequada', () => {
    it('deve rejeitar com 403 quando role inadequada é usada', () => {
      /**
       * Cenário:
       * @UseGuards(JwtAuthGuard, RolesGuard)
       * @Roles(Role.ADMINISTRADOR)
       * async deleteUser() { ... }
       *
       * Token do usuário: role = 'cliente'
       *
       * Esperado: 403 Forbidden
       */
      reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.CLIENTE },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);

      // NestJS interpreta false como 403 Forbidden automaticamente
      expect(result).toBe(false);
    });

    it('deve retornar false para role: cliente quando requer administrador', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.CLIENTE },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
    });

    it('deve retornar false para role: vendedor quando requer gerente', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.GERENTE]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.VENDEDOR },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
    });

    it('deve retornar false para role: caixa quando requer administrador', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.CAIXA },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
    });
  });

  describe('Critério de aceite: Múltiplos perfis aceitáveis', () => {
    it('deve aceitar role quando está em múltiplos perfis permitidos', () => {
      /**
       * Cenário:
       * @Roles(Role.ADMINISTRADOR, Role.GERENTE)
       *
       * Token do usuário: role = 'gerente'
       *
       * Esperado: 200 OK (true)
       */
      reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR, Role.GERENTE]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.GERENTE },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('deve aceitar admin quando @Roles(admin, gerente)', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR, Role.GERENTE]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.ADMINISTRADOR },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('deve aceitar qualquer role em @Roles(admin, gerente, vendedor, caixa, cliente)', () => {
      const allRoles = [Role.ADMINISTRADOR, Role.GERENTE, Role.VENDEDOR, Role.CAIXA, Role.CLIENTE];

      reflector.getAllAndOverride.mockReturnValue(allRoles);

      allRoles.forEach((role) => {
        const mockExecutionContext = {
          switchToHttp: () => ({
            getRequest: () => ({
              user: { role },
            }),
          }),
          getHandler: () => ({}),
          getClass: () => ({}),
        } as unknown as ExecutionContext;

        const result = guard.canActivate(mockExecutionContext);
        expect(result).toBe(true);
      });
    });

    it('deve rejeitar role fora da lista de múltiplos perfis', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR, Role.GERENTE]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.CLIENTE },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
    });

    it('deve aceitar vendedor quando @Roles(vendedor, caixa)', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.VENDEDOR, Role.CAIXA]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.VENDEDOR },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });

  describe('Casos extremos', () => {
    it('deve retornar false quando user é undefined', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: undefined,
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
    });

    it('deve retornar false quando user.role é undefined', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: undefined },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
    });

    it('deve retornar false quando user é null', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: null,
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
    });

    it('deve retornar false quando requiredRoles é array vazio (nunca deve acontecer)', () => {
      reflector.getAllAndOverride.mockReturnValue([]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.CLIENTE },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
    });
  });

  describe('Case sensitivity', () => {
    it('deve fazer match exato de role (case-sensitive)', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: 'ADMINISTRADOR' }, // uppercase
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      // Enum value é 'administrador' (lowercase), não 'ADMINISTRADOR'
      expect(result).toBe(false);
    });

    it('deve aceitar role com case correto', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: 'administrador' }, // lowercase correto
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });
  });

  describe('Integração com @Roles() decorator', () => {
    it('deve usar Reflector.getAllAndOverride() para obter metadata de @Roles()', () => {
      reflector.getAllAndOverride.mockReturnValue([Role.GERENTE]);

      const mockHandler = jest.fn();
      const mockClass = jest.fn();
      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.GERENTE },
          }),
        }),
        getHandler: () => mockHandler,
        getClass: () => mockClass,
      } as unknown as ExecutionContext;

      guard.canActivate(mockExecutionContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [mockHandler, mockClass]);
    });

    it('deve passar handler e class corretos para Reflector.getAllAndOverride()', () => {
      const mockHandler = jest.fn();
      const mockClass = jest.fn();
      reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.ADMINISTRADOR },
          }),
        }),
        getHandler: () => mockHandler,
        getClass: () => mockClass,
      } as unknown as ExecutionContext;

      guard.canActivate(mockExecutionContext);

      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [mockHandler, mockClass]);
    });
  });

  describe('Testes E2E (cenários realistas)', () => {
    it('Cenário 1: Admin deletando usuário com @Roles(ADMINISTRADOR)', () => {
      /**
       * @UseGuards(JwtAuthGuard, RolesGuard)
       * @Roles(Role.ADMINISTRADOR)
       * @Delete('users/:id')
       * async deleteUser(@Param('id') id: string) { ... }
       *
       * Usuário com token admin tentando deletar → 200 OK
       */
      reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.ADMINISTRADOR },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(true);
    });

    it('Cenário 2: Cliente tentando deletar usuário com @Roles(ADMINISTRADOR)', () => {
      /**
       * @UseGuards(JwtAuthGuard, RolesGuard)
       * @Roles(Role.ADMINISTRADOR)
       * @Delete('users/:id')
       * async deleteUser(@Param('id') id: string) { ... }
       *
       * Usuário com token cliente tentando deletar → 403 Forbidden
       */
      reflector.getAllAndOverride.mockReturnValue([Role.ADMINISTRADOR]);

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.CLIENTE },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      const result = guard.canActivate(mockExecutionContext);
      expect(result).toBe(false);
    });

    it('Cenário 3: Gerente vendo dashboard com @Roles(GERENTE, ADMINISTRADOR)', () => {
      /**
       * @UseGuards(JwtAuthGuard, RolesGuard)
       * @Roles(Role.GERENTE, Role.ADMINISTRADOR)
       * @Get('dashboard')
       * async viewDashboard() { ... }
       *
       * Gerente → 200 OK
       * Admin → 200 OK
       * Vendedor → 403 Forbidden
       */
      reflector.getAllAndOverride.mockReturnValue([Role.GERENTE, Role.ADMINISTRADOR]);

      // Gerente OK
      let mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.GERENTE },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(mockExecutionContext)).toBe(true);

      // Admin OK
      mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.ADMINISTRADOR },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(mockExecutionContext)).toBe(true);

      // Vendedor REJEITADO
      mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: Role.VENDEDOR },
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(mockExecutionContext)).toBe(false);
    });
  });
});
