import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function mockContext(userRole: Role | null): ExecutionContext {
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user: userRole ? { role: userRole } : null }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should allow access when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);
    const ctx = mockContext(Role.CUSTOMER);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow access when user has the required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const ctx = mockContext(Role.ADMIN);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should deny access when user does not have the required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([Role.ADMIN]);
    const ctx = mockContext(Role.CUSTOMER);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('should allow access when user has one of multiple required roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([Role.ADMIN, Role.MANAGER]);
    const ctx = mockContext(Role.MANAGER);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
