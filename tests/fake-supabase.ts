/**
 * Minimal in-memory stand-in for the subset of the Supabase query builder the
 * repositories actually use. It models the one behaviour the sync contract
 * depends on: `upsert` with an `onConflict` key replaces a row rather than
 * inserting a duplicate.
 */

type Row = Record<string, unknown>;

export class FakeSupabase {
  readonly tables = new Map<string, Map<string, Row>>();
  private sequence = 0;

  from(table: string) {
    return new FakeQuery(this, table);
  }

  rowsOf(table: string): Row[] {
    return [...(this.tables.get(table)?.values() ?? [])];
  }

  countOf(table: string): number {
    return this.tables.get(table)?.size ?? 0;
  }

  reset(): void {
    this.tables.clear();
    this.sequence = 0;
  }

  nextId(): string {
    this.sequence += 1;
    return `row-${this.sequence}`;
  }

  store(table: string): Map<string, Row> {
    const existing = this.tables.get(table);
    if (existing) return existing;
    const created = new Map<string, Row>();
    this.tables.set(table, created);
    return created;
  }
}

class FakeQuery {
  private filters: Array<[string, unknown]> = [];
  private results: Row[] = [];
  private didWrite = false;

  constructor(
    private readonly client: FakeSupabase,
    private readonly table: string,
  ) {}

  select(_columns?: string): this {
    void _columns;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push([column, value]);
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push([`${column}__in`, values]);
    return this;
  }

  order(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  upsert(rows: Row | Row[], options?: { onConflict?: string }): this {
    const list = Array.isArray(rows) ? rows : [rows];
    const store = this.client.store(this.table);
    const keyColumns = (options?.onConflict ?? 'id').split(',').map((c) => c.trim());

    this.results = list.map((row) => {
      const key = keyColumns.map((column) => String(row[column])).join('|');
      const existing = store.get(key);
      const merged: Row = {
        id: existing?.id ?? this.client.nextId(),
        ...existing,
        ...row,
      };
      store.set(key, merged);
      return merged;
    });

    this.didWrite = true;
    return this;
  }

  private matching(): Row[] {
    return this.client.rowsOf(this.table).filter((row) =>
      this.filters.every(([column, value]) => {
        if (column.endsWith('__in')) {
          const field = column.slice(0, -4);
          return (value as unknown[]).includes(row[field]);
        }
        return row[column] === value;
      }),
    );
  }

  async maybeSingle(): Promise<{ data: Row | null; error: null }> {
    const rows = this.didWrite ? this.results : this.matching();
    return { data: rows[0] ?? null, error: null };
  }

  async single(): Promise<{ data: Row | null; error: null }> {
    return this.maybeSingle();
  }

  // Awaiting the builder directly returns every matching/written row.
  then<TResult>(
    resolve: (value: { data: Row[]; error: null }) => TResult,
  ): Promise<TResult> {
    const rows = this.didWrite ? this.results : this.matching();
    return Promise.resolve(resolve({ data: rows, error: null }));
  }
}
