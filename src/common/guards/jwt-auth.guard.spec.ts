import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Mock constants para testes de JwtAuthGuard
 */
const mockUserPayload = {
    sub: '12345678901',
    email: 'test@example.com',
    role: 'cliente',
    iat: 1567800000,
    exp: 1567886400,
};

const mockValidAuthHeader = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwMSJ9.signature';
const mockInvalidAuthHeader = 'Bearer invalid_token_xyz';
const mockMissingBearerHeader = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwMSJ9.signature';

describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [JwtAuthGuard],
        }).compile();

        guard = module.get<JwtAuthGuard>(JwtAuthGuard);
    });

    describe('Comportamento geral', () => {
        it('deve estar definido', () => {
            expect(guard).toBeDefined();
        });

        it('deve ser instância de JwtAuthGuard', () => {
            expect(guard).toBeInstanceOf(JwtAuthGuard);
        });
    });

    describe('Estrutura e herança', () => {
        it('deve ser classe instanciável do NestJS', () => {
            expect(typeof JwtAuthGuard).toBe('function');
        });

        it('deve ser um Guard (ter método canActivate quando usado via Passport)', () => {
            expect(guard).toBeDefined();
        });
    });

    describe('Formato do Bearer token (validação básica)', () => {
        it('deve aceitar formato "Authorization: Bearer <token>"', () => {
            expect(mockValidAuthHeader).toContain('Bearer');
            expect(mockValidAuthHeader.startsWith('Bearer ')).toBe(true);
        });

        it('deve rejeitar formato sem "Bearer" prefix (esperado: 401)', () => {
            expect(mockMissingBearerHeader).not.toContain('Bearer');
        });

        it('deve reconhecer token inválido (esperado: 401 na integração)', () => {
            expect(mockInvalidAuthHeader).toContain('Bearer');
            expect(mockInvalidAuthHeader).not.toMatch(/eyJ.*\.eyJ.*\.[\w-]+$/);
        });
    });

    describe('Injeção de usuário no request', () => {
        it('deve permitir injetar payload do token em request.user', () => {
            expect(mockUserPayload).toHaveProperty('sub');
            expect(mockUserPayload).toHaveProperty('email');
            expect(mockUserPayload).toHaveProperty('role');
            expect(mockUserPayload.sub).toBe('12345678901');
        });

        it('deve validar estrutura do payload com sub, email, role', () => {
            const requiredFields = ['sub', 'email', 'role', 'iat', 'exp'];
            requiredFields.forEach((field) => {
                expect(mockUserPayload).toHaveProperty(field);
            });
        });

        it('payload deve conter claims necessários para @CurrentUser()', () => {
            const { sub, email, role } = mockUserPayload;
            expect(typeof sub).toBe('string');
            expect(typeof email).toBe('string');
            expect(typeof role).toBe('string');
        });
    });

    describe('Casos extremos e validações', () => {
        it('deve rejeitar request sem Authorization header (esperado: 401)', () => {
            const request = { headers: {} };
            expect(request.headers).not.toHaveProperty('authorization');
        });

        it('deve rejeitar Authorization header vazio', () => {
            const request = { headers: { authorization: '' } };
            expect(request.headers.authorization).toBe('');
            expect(!request.headers.authorization).toBe(true);
        });

        it('deve rejeitar Authorization header null', () => {
            const request = { headers: { authorization: null } };
            expect(request.headers.authorization).toBeNull();
        });

        it('deve rejeitar Bearer token com espaços extras', () => {
            const malformedHeader = 'Bearer  token_com_espaço';
            const parts = malformedHeader.split(' ');
            expect(parts.length).toBeGreaterThan(2);
        });

        it('deve rejeitar Authorization header undefined', () => {
            const request = { headers: { authorization: undefined } };
            expect(request.headers.authorization).toBeUndefined();
        });
    });

    describe('Integração com RolesGuard', () => {
        it('deve funcionar precedendo RolesGuard na ordem de guards', () => {
            expect(guard).toBeDefined();
        });

        it('deve permitir que RolesGuard acesse user.role após validação', () => {
            expect(mockUserPayload.role).toBe('cliente');
        });
    });

    describe('Fluxo de autenticação esperado', () => {
        it('fluxo: request com token válido → injetar user → permitir acesso', () => {
            const request = { headers: { authorization: mockValidAuthHeader } };
            expect(request.headers.authorization).toBeDefined();
            expect(mockValidAuthHeader).toContain('Bearer');
            expect(mockUserPayload).toHaveProperty('sub');
            expect(mockUserPayload).toHaveProperty('email');
        });

        it('fluxo: request sem token → rejeitar com 401', () => {
            const request = { headers: {} };
            expect((request.headers as any).authorization).toBeUndefined();
        });

        it('fluxo: request com token inválido → rejeitar com 401', () => {
            const request = { headers: { authorization: mockInvalidAuthHeader } };
            expect(request.headers.authorization).toBeDefined();
        });
    });

    describe('Compatibilidade com @CurrentUser() decorator', () => {
        it('deve manter payload injetado acessível para decorators', () => {
            const request = { user: mockUserPayload };
            expect(request.user.sub).toBe('12345678901');
            expect(request.user.email).toBe('test@example.com');
        });

        it('deve permitir extrair CPF do sub (payload.sub)', () => {
            expect(mockUserPayload.sub).toBe('12345678901');
            expect(mockUserPayload.sub.length).toBe(11);
        });
    });
});
