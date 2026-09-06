export function createRetryableSingleFlight<T>(factory: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;

  return () => {
    if (inFlight !== null) return inFlight;

    const current = factory();
    inFlight = current;
    void current.catch(() => {
      if (inFlight === current) inFlight = null;
    });
    return current;
  };
}
