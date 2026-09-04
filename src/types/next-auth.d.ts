import type { Role } from '@prisma/client';
import type { DefaultSession } from 'next-auth';

// NextAuth এর ডিফল্ট টাইপে আমাদের `role` ও `id` যোগ করা হচ্ছে
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: Role;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: Role;
  }
}
