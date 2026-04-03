import { SalesService } from './sales.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SalesService - calculateCommission', () => {
  let service: SalesService;

  beforeEach(() => {
    service = new SalesService({} as PrismaService);
  });

  it('should calculate 2.5% commission on a given total', () => {
    const commission = service.calculateCommission(1000);
    expect(commission).toBeCloseTo(25, 2);
  });

  it('should return 0 commission for 0 total', () => {
    const commission = service.calculateCommission(0);
    expect(commission).toBe(0);
  });

  it('should handle decimal amounts correctly', () => {
    const commission = service.calculateCommission(199.99);
    expect(commission).toBeCloseTo(4.99975, 4);
  });
});
