import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { HealthController } from './health.controller';

describe('HealthController', () => {
  const query = jest.fn();
  let controller: HealthController;

  beforeEach(async () => {
    query.mockReset();
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DataSource, useValue: { query } }],
    }).compile();

    controller = module.get(HealthController);
  });

  it('returns liveness without querying the database', () => {
    expect(controller.check()).toMatchObject({ status: 'ok' });
    expect(query).not.toHaveBeenCalled();
  });

  it('returns ready when the database responds', async () => {
    query.mockResolvedValue([{ '?column?': 1 }]);

    await expect(controller.ready()).resolves.toMatchObject({ status: 'ready' });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('returns a sanitized 503 when the database is unavailable', async () => {
    query.mockRejectedValue(new Error('password authentication failed for secret-user'));

    await expect(controller.ready()).rejects.toThrow(ServiceUnavailableException);
    await expect(controller.ready()).rejects.not.toThrow('secret-user');
  });
});
