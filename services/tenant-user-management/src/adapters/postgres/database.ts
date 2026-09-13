// Connections to the service's schema, and the one place tenant context is set (ADR-0021). Context
// lives for a single explicit transaction, set with set_config(..., true), so a server connection
// goes back to PgBouncer carrying nothing for the next client. node-postgres sends unnamed
// statements unless a query is given a name, which keeps transaction pooling safe.
import pg from 'pg';
import type { TenantId } from '../../domain/identifiers.ts';

/** What work inside a transaction may do: run statements, and nothing about the transaction itself. */
export interface Statements {
  query<Row extends pg.QueryResultRow = pg.QueryResultRow>(text: string, values?: unknown[]): Promise<Row[]>;
}

export interface Database {
  /** Runs work in one transaction whose tenant context is this Tenant. */
  inTenant<T>(tenantId: TenantId, work: (statements: Statements) => Promise<T>): Promise<T>;
  /**
   * Runs work in one transaction with no tenant context, where row-level security admits nothing
   * tenant-scoped. For what is read before a Tenant is known, such as the tenant directory.
   */
  withoutTenant<T>(work: (statements: Statements) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export interface ConnectOptions {
  readonly max?: number;
  /**
   * Called when a pooled connection fails while idle, as when the pooler or the database goes away.
   * node-postgres emits that on the pool, and left unhandled it ends the process: a lost dependency
   * would become a crash instead of a 503.
   */
  readonly onIdleConnectionError: (error: Error) => void;
}

export function connect(connectionString: string, options: ConnectOptions): Database {
  // A connection that cannot be made within the timeout is an error, never a wait: an unreachable
  // database must fail a request, and a health check, rather than hang it.
  const pool = new pg.Pool({
    connectionString,
    max: options.max ?? 10,
    connectionTimeoutMillis: 5_000,
  });
  pool.on('error', options.onIdleConnectionError);

  async function transaction<T>(
    tenantId: TenantId | undefined,
    work: (statements: Statements) => Promise<T>,
  ): Promise<T> {
    const client = await pool.connect();
    const statements: Statements = {
      query: async <Row extends pg.QueryResultRow>(text: string, values: unknown[] = []) =>
        (await client.query<Row>(text, values)).rows,
    };
    try {
      await client.query('BEGIN');
      if (tenantId !== undefined) {
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      }
      const result = await work(statements);
      await client.query('COMMIT');
      client.release();
      return result;
    } catch (error) {
      // A connection whose transaction could not be rolled back is discarded, never pooled again.
      const rolledBack = await client.query('ROLLBACK').then(
        () => true,
        () => false,
      );
      client.release(!rolledBack);
      throw error;
    }
  }

  return {
    inTenant: (tenantId, work) => transaction(tenantId, work),
    withoutTenant: (work) => transaction(undefined, work),
    close: () => pool.end(),
  };
}
