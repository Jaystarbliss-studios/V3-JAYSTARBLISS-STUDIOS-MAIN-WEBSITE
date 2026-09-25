export type ResourceDateSort = 'recent' | 'oldest';

export function resourceDateMs(value: any): number {
  if (!value) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') { const n = Date.parse(value); return Number.isFinite(n) ? n : 0; }
  if (value?.toDate instanceof Function) return value.toDate().getTime();
  if (typeof value?.seconds === 'number') return value.seconds * 1000;
  if (value instanceof Date) return value.getTime();
  return 0;
}

export function sortResourcesByDate<T extends Record<string, any>>(items: T[], mode: ResourceDateSort): T[] {
  return [...items].sort((a, b) => {
    const delta = resourceDateMs(b.createdAt ?? b.updatedAt ?? b.timestamp ?? b.date) - resourceDateMs(a.createdAt ?? a.updatedAt ?? a.timestamp ?? a.date);
    return mode === 'oldest' ? -delta : delta;
  });
}
