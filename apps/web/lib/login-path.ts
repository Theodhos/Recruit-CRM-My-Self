/**
 * Where the sign-in page lives. Defaults to /login. Set NEXT_PUBLIC_LOGIN_PATH (e.g. /s-1a2b3c...) to serve it at an
 * unguessable address instead: middleware.ts then answers 404 on /login itself and sends signed-out visitors of
 * protected pages to the landing page rather than to the sign-in page, so the address is never revealed.
 */
export const LOGIN_PATH = (process.env.NEXT_PUBLIC_LOGIN_PATH || '/login').replace(/\/$/, '') || '/login';
