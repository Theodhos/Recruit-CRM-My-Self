import { useEffect, useState } from 'react';

/** A text value that follows what is typed after a short pause — so the list is not asked again on every key. */
export function useDebounced<T>(value: T, ms = 700) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
