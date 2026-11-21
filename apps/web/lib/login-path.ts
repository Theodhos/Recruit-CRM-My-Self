/**
 * Where the sign-in page lives. Set NEXT_PUBLIC_LOGIN_PATH (e.g. in Vercel; never commit the real value) to an unguessable address (e.g.
 * /s-1a2b3c...) to change it without touching code. middleware.ts answers 404 on /login itself and sends signed-out
 * visitors of protected pages to the landing page rather than to the sign-in page, so the address is never revealed.
 * (Set NEXT_PUBLIC_LOGIN_PATH=/login to get the ordinary /login back, e.g. for local development.)
 */
export const LOGIN_PATH = (process.env.NEXT_PUBLIC_LOGIN_PATH || '/login').replace(/\/$/, '') || '/login';
