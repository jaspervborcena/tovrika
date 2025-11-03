/**
 * Try network fetch, then cache fetch, then return default value.
 * Keeps errors internal so components can render friendly UI instead of crashing.
 */
export async function loadWithFallback<T>(
  fetchNetwork: () => Promise<T>,
  fetchCache: () => Promise<T | null | undefined>,
  defaultValue: T
): Promise<T> {
  try {
    const networkResult = await fetchNetwork();
    if (networkResult !== undefined && networkResult !== null) return networkResult;
  } catch (e) {
    // network failed -> try cache
    console.warn('loadWithFallback: network fetch failed, trying cache', e);
  }

  try {
    const cached = await fetchCache();
    if (cached !== undefined && cached !== null) return cached as T;
  } catch (e) {
    console.warn('loadWithFallback: cache fetch failed', e);
  }

  return defaultValue;
}
