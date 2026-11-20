import { NextResponse, type NextRequest } from 'next/server';

import { LOGIN_PATH } from '@/lib/login-path';
import { updateSession } from '@/utils/supabase/middleware';

const SESSION_COOKIE = 'crm_session';
const REFRESH_COOKIE = 'crm_refresh';
// With NEXT_PUBLIC_LOGIN_PATH set, the sign-in page is only reachable at that address; /login itself answers 404.
const HIDDEN_LOGIN = LOGIN_PATH !== '/login';
// `/verify-code` is step two of signing in: the password was accepted, the e-mailed code not yet — no session exists.
const PUBLIC_PATHS = [LOGIN_PATH, '/register', '/forgot-password', '/reset-password', '/verify-code'];

/**
 * Route-level auth gate: unauthenticated requests to anything outside the
 * (auth) route group are redirected to /login; authenticated requests to an
 * auth page are redirected to /dashboard. This checks cookie *presence*
 * only — the API is the source of truth for token validity (see
 * docs/architecture/authentication.md). Do not add business logic here.
 *
 * Login verified end-to-end against the API (2026-09-09) — re-enabled after
 * a temporary disable used to preview /dashboard's UI before the DB/API
 * were wired up. Leaving this false in production would make every route
 * reachable without authentication.
 */
const AUTH_ENFORCED = true;

export async function middleware(request: NextRequest) {
  if (!AUTH_ENFORCED) {
    return NextResponse.next();
  }

  const supabaseResponse = await updateSession(request);

  // The access cookie lives 15 minutes, the refresh cookie 7 days. Either one means "signed in": with only the refresh
  // cookie left, the first API call refreshes the session (see lib/api-client.ts) instead of bouncing to /login.
  const hasSession = request.cookies.has(SESSION_COOKIE) || request.cookies.has(REFRESH_COOKIE);
  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (HIDDEN_LOGIN) {
    const { pathname } = request.nextUrl;
    // the real route stays /login internally; nobody may open it by that name
    if (pathname === '/login' || pathname.startsWith('/login/')) {
      return NextResponse.rewrite(new URL('/_not-found-login', request.url));
    }
    // the secret address shows the sign-in page, keeping the secret address in the browser bar
    if (pathname === LOGIN_PATH) {
      if (hasSession) {
        const response = NextResponse.redirect(new URL('/dashboard', request.url));
        copyCookies(supabaseResponse, response);
        return response;
      }
      const target = request.nextUrl.clone();
      target.pathname = '/login';
      const response = NextResponse.rewrite(target);
      copyCookies(supabaseResponse, response);
      return response;
    }
  }

  // The site root is the public landing page: visitors see it, signed-in users go straight to the dashboard.
  if (request.nextUrl.pathname === '/') {
    if (hasSession) {
      const response = NextResponse.redirect(new URL('/dashboard', request.url));
      copyCookies(supabaseResponse, response);
      return response;
    }
    return supabaseResponse;
  }

  if (!hasSession && !isPublicPath) {
    // with a hidden sign-in address, signed-out visitors go to the public landing page so the address is not leaked
    const loginUrl = new URL(HIDDEN_LOGIN ? '/' : '/login', request.url);
    // the root only forwards to /dashboard, which is where a sign-in without `redirectTo` already ends up
    if (request.nextUrl.pathname !== '/') {
      loginUrl.searchParams.set('redirectTo', request.nextUrl.pathname);
    }
    const response = NextResponse.redirect(loginUrl);
    copyCookies(supabaseResponse, response);
    return response;
  }

  if (hasSession && isPublicPath) {
    const response = NextResponse.redirect(new URL('/dashboard', request.url));
    copyCookies(supabaseResponse, response);
    return response;
  }

  return supabaseResponse;
}

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach(({ name, value }) => target.cookies.set(name, value));
}

export const config = {
  // `healthz` (probe), `icon.svg` (favicon) and `landing` (photos of the public home page) must be reachable without a session.
  matcher: ['/((?!api|healthz|landing|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
