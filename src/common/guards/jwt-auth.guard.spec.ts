import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;

    beforeEach(() => {
        guard = new JwtAuthGuard();
    });

    it('deve estar definido', () => {
        expect(guard).toBeDefined();
    });

    it('deve delegar para AuthGuard("jwt") e retornar true com token válido', async () => {
        const mockContext = {} as ExecutionContext;
        const parentCanActivate = jest
            .spyOn(AuthGuard('jwt').prototype, 'canActivate')
            .mockResolvedValue(true);

        const result = await guard.canActivate(mockContext);

        expect(parentCanActivate).toHaveBeenCalledWith(mockContext);
        expect(result).toBe(true);
        parentCanActivate.mockRestore();
    });

    it('deve lançar UnauthorizedException quando o token está ausente', async () => {
        const mockContext = {} as ExecutionContext;
        jest
            .spyOn(AuthGuard('jwt').prototype, 'canActivate')
            .mockRejectedValue(new UnauthorizedException());

        await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException quando o token é inválido ou expirado', async () => {
        const mockContext = {} as ExecutionContext;
        jest
            .spyOn(AuthGuard('jwt').prototype, 'canActivate')
            .mockRejectedValue(new UnauthorizedException('Token inválido'));

        await expect(guard.canActivate(mockContext)).rejects.toThrow(UnauthorizedException);
    });
});
