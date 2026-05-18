/**
 * JwtAuthGuard
 *
 * Guard de autenticação via JWT (JSON Web Token).
 * Valida se a requisição contém um token JWT válido no header Authorization.
 *
 * Comportamento:
 * -  Token válido: permite acesso, injeta usuário no request
 * -  Sem token: retorna 401 Unauthorized
 * -  Token inválido/expirado: retorna 401 Unauthorized
 *
 * Uso em endpoints:
 * @UseGuards(JwtAuthGuard)
 * async findOne(@Param('id') id: string) {
 *   // Apenas usuários autenticados chegam aqui
 * }
 *
 * Com outros guards:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('admin', 'gerente')
 * async remove(@Param('id') id: string) {
 *   // Apenas admin e gerente autenticados chegam aqui
 * }
 *
 * Extração do token:
 * - Header: Authorization: Bearer <token>
 * - Validação: Usa JwtStrategy do módulo auth
 * - Secret: JWT_SECRET do .env
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') { }
