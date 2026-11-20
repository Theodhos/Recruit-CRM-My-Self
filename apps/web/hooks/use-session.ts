import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getSession, logout } from '@/services/auth.service';

/** Per-tab marker (sessionStorage dies with the tab): set when this tab signed in, see markTabSignedIn. */
const TAB_KEY = 'crm.tabSignedIn';

export function markTabSignedIn() {
  try {
    sessionStorage.setItem(TAB_KEY, '1');
  } catch {
    /* private mode */
  }
}

/** A tab that never signed in (closed and reopened) must sign in again, with the code. */
async function getTabSession() {
  let signedIn = true;
  try {
    signedIn = sessionStorage.getItem(TAB_KEY) === '1';
  } catch {
    /* storage blocked: do not lock the user out */
  }
  if (!signedIn) {
    await logout().catch(() => undefined);
    window.location.assign('/login');
    throw new Error('Signed out');
  }
  return getSession();
}

/**
 * The one source of truth for "who is logged in" on the client. The
 * session cookie itself is httpOnly (set by apps/api — see
 * common/utils/auth-cookies.ts), so the frontend never reads a token
 * directly; it always asks /auth/me. `retry: false` because a 401 here
 * means "not logged in", not a transient failure worth retrying.
 */
export function useSession() {
  return useQuery({
    queryKey: ['session'],
    queryFn: getTabSession,
    retry: false,
    staleTime: 60_000,
  });
}

export function useInvalidateSession() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['session'] });
}
