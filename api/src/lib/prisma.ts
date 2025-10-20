import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

if (!(global as any).prisma) {
  (global as any).prisma = new PrismaClient({
    log: ['error', 'warn']
  });
}

prisma = (global as any).prisma as PrismaClient;

export default prisma;
