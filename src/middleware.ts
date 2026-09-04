import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import { canAccessRoute, homeForRole } from '@/lib/rbac';

/**
 * Route protection — লগইন না থাকলে /login এ, ভুল role হলে নিজের panel এ redirect।
 * Permission matrix: `src/lib/rbac.ts`
 */
export default withAuth(
  function middleware(req) {
    const { token } = req.nextauth;
    const { pathname } = req.nextUrl;
    const role = token?.role;

    if (!canAccessRoute(role, pathname)) {
      // লগইন করা আছে কিন্তু এই panel এ ঢোকার অনুমতি নেই → নিজের panel এ পাঠাই
      return NextResponse.redirect(new URL(homeForRole(role), req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      // token না থাকলে withAuth নিজেই /login এ পাঠাবে
      authorized: ({ token }) => Boolean(token),
    },
    pages: {
      signIn: '/login',
    },
  },
);

export const config = {
  matcher: ['/admin/:path*', '/sales/:path*', '/engineer/:path*', '/accounts/:path*', '/customer/:path*'],
};
