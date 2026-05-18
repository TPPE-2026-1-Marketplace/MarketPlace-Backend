/**
 * @Roles(...roles)
 *
 * Decorator que marca quais roles podem acessar um endpoint.
 * Deve ser usado com RolesGuard para validação.
 *
 * Aceita múltiplos perfis (OR logic):
 * - @Roles('admin') → apenas admin
 * - @Roles('admin', 'gerente') → admin OU gerente
 * - @Roles('admin', 'gerente', 'caixa') → qualquer um desses 3
 *
 * Roles disponíveis:
 * - Role.CLIENTE
 * - Role.CAIXA
 * - Role.VENDEDOR
 * - Role.GERENTE
 * - Role.ADMINISTRADOR
 *
 * Uso:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles(Role.ADMINISTRADOR, Role.GERENTE)
 * async deleteUser(@Param('id') id: string) { ... }
 *
 * Nota: Sem @Roles(), RolesGuard permite qualquer usuario autenticado.
 */

import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
