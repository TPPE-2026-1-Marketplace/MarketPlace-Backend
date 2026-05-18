/**
 * RolesGuard
 *
 * Guard de autorização baseado em roles (perfis de usuário).
 * Verifica se o usuário autenticado possui uma das roles necessárias.
 *
 * IMPORTANTE: Use com JwtAuthGuard para garantir que o usuário está autenticado.
 *
 * Comportamento:
 * - Sem @Roles(): permite qualquer usuário autenticado
 * - Com @Roles('admin'): apenas admin pode acessar
 * - Com @Roles('admin', 'gerente'): admin OU gerente podem acessar
 * - Role inadequada: retorna 403 Forbidden
 *
 * Roles disponíveis (conforme Role enum):
 * - 'cliente': usuário comum
 * - 'caixa': pode registrar vendas
 * - 'vendedor': pode ver comissões
 * - 'gerente': acesso a dashboards e estoque
 * - 'administrador': acesso total
 *
 * Uso em endpoints:
 *
 * 1️ Apenas autenticado (qualquer role):
 * @UseGuards(JwtAuthGuard)
 * async findAll() { ... }
 *
 * 2️ Apenas admin:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('administrador')
 * async deleteAll() { ... }
 *
 * 3️ Admin OU Gerente:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('administrador', 'gerente')
 * async viewDashboard() { ... }
 *
 * Fluxo de validação:
 * 1. JwtAuthGuard valida token e injeta user no request
 * 2. Reflector extrai roles da metadata @Roles()
 * 3. Compara user.role com roles requiridas
 * 4. Retorna true (permite) ou false (bloqueia com 403)
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums/role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.get<Role[]>('roles', context.getHandler());
        if (!requiredRoles) {
            return true;
        }

        const { user } = context.switchToHttp().getRequest();
        return requiredRoles.some((role) => user?.role === role);
    }
}
