import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AuthController } from '../../auth/auth.controller';
import { ImagesController } from '../../images/images.controller';
import { InventoryController } from '../../inventory/inventory.controller';
import { OrdersController } from '../../orders/orders.controller';
import { PaymentsController } from '../../payments/payments.controller';
import { PeopleController } from '../../people/people.controller';
import { ProductsController } from '../../products/products.controller';

type Controller = { prototype: object; name: string };

const THROTTLE_LIMIT_KEY = 'THROTTLER:LIMITdefault';

function handlersOf(controller: Controller) {
  const proto = controller.prototype as Record<string, unknown>;
  return Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor' && typeof proto[name] === 'function')
    .map((name) => ({ name: `${controller.name}.${name}`, handler: proto[name] as object }));
}

function hasThrottlerGuard(handler: object): boolean {
  const guards: unknown[] = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
  return guards.includes(ThrottlerGuard);
}

describe('rate limiting por rota (#156)', () => {
  const throttled = [AuthController, PeopleController, OrdersController, PaymentsController]
    .flatMap(handlersOf)
    .filter(({ handler }) => Reflect.getMetadata(THROTTLE_LIMIT_KEY, handler) !== undefined);

  it('aplica limite em login, cadastro e checkout', () => {
    expect(throttled.map(({ name }) => name).sort()).toEqual([
      'AuthController.login',
      'OrdersController.create',
      'OrdersController.createGuest',
      'PaymentsController.create',
      'PaymentsController.createGuest',
      'PeopleController.registerUser',
    ]);
  });

  it.each(throttled.map(({ name, handler }) => [name, handler]))(
    '%s tem ThrottlerGuard (sem guard global, @Throttle sozinho não limita)',
    (_name, handler) => {
      expect(hasThrottlerGuard(handler as object)).toBe(true);
    },
  );

  it.each(
    [ProductsController, InventoryController, ImagesController]
      .flatMap(handlersOf)
      .map(({ name, handler }) => [name, handler]),
  )('%s não é limitado (catálogo carrega 2 requisições por variante)', (_name, handler) => {
    expect(hasThrottlerGuard(handler as object)).toBe(false);
  });
});
