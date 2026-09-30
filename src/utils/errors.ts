/**
 * True when a request failed because the record does not exist, as opposed to
 * the API being unreachable or failing. NetworkError from @sudobility/types
 * carries the HTTP status; anything without one is not a 404.
 */
export function isNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { status?: unknown }).status === 404
  );
}

/**
 * Classify a detail query: loading, found, missing, or failed.
 *
 * Order matters: a disabled query (empty route param) is not found; loading
 * is neither; a 404 error is not found; any other error is returned for the
 * page's error state; a settled response without `success: true` is not
 * found. Pages render Loading, then ErrorState, then EmptyState from this.
 */
export function detailState(query: {
  isLoading: boolean;
  error: Error | null;
  data: { success?: boolean } | undefined;
  enabled: boolean;
}): { notFound: boolean; error: Error | null } {
  if (!query.enabled) return { notFound: true, error: null };
  if (query.isLoading) return { notFound: false, error: null };
  if (query.error) {
    return isNotFoundError(query.error)
      ? { notFound: true, error: null }
      : { notFound: false, error: query.error };
  }
  return { notFound: query.data?.success !== true, error: null };
}
