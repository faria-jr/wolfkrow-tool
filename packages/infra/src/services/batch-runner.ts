export async function runInBatches<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function next(): Promise<void> {
    const i = index++;
    if (i >= items.length) return;
    const item = items[i];
    if (item === undefined) return;
    const result = await worker(item);
    results[i] = result;
    await next();
  }

  const workers = Array.from({ length: concurrency }, () => next());
  await Promise.all(workers);
  return results;
}
