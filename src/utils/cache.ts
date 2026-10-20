interface CachedValue<T> {
  value: T;
  expires: number;
}


export class TtlCache<T> {
  private readonly entries = new Map<string, CachedValue<T>>();

  constructor(
    private readonly maxEntries = 500,
  ) {}

  get(key: string): T | undefined {
    const entry = this.entries.get(key);

    if (!entry) {
      return undefined;
    }

    if (entry.expires <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }

    return entry.value;
  }

  set(
    key: string,
    value: T,
    ttlMs: number,
  ): void {
    if (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;

      if (oldestKey !== undefined) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(key, {
      value,
      expires: Date.now() + ttlMs,
    });
  }
}