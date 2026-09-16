/**
 * Shared scaffolding for the in-memory mock D1 database each backend test
 * file builds — every file below has its own table set and its own SQL
 * dispatch logic in `all()` (the real substance of each mock), but the outer
 * shell (constructor/prepare/batch, and the prepared-statement's
 * bind/first/run) was identical boilerplate copy-pasted across all of them.
 */
export class MockD1PreparedStatementBase {
  constructor(db, sql) {
    this.db = db;
    this.sql = sql.trim();
    this.boundParams = [];
  }

  bind(...params) {
    this.boundParams = params;
    return this;
  }

  async first() {
    const res = await this.all();
    return res.results[0] || null;
  }

  async run() {
    return this.all();
  }
}

/**
 * Builds a MockD1 class backed by `this.tables` (one Map per name in
 * `tableNames`), using `StatementClass` (a MockD1PreparedStatementBase
 * subclass implementing `all()`) for `prepare()`.
 */
export function createMockD1(tableNames, StatementClass) {
  return class MockD1 {
    constructor() {
      this.tables = {};
      for (const name of tableNames) this.tables[name] = new Map();
    }

    prepare(sql) {
      return new StatementClass(this, sql);
    }

    async batch(statements) {
      const results = [];
      for (const stmt of statements) {
        results.push(await stmt.run());
      }
      return results;
    }
  };
}
