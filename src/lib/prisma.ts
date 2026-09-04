import { PrismaClient } from '@prisma/client';

// Next.js dev এ hot-reload প্রতি নতুন PrismaClient তৈরি হওয়া ঠেকাতে global cache
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
