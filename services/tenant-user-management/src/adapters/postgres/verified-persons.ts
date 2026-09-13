// Verified Persons as the identity-sync role reaches them (ADR-0024). The role has no tenant context,
// reads only Persons the identity provider verified, and can change only their name and email: row-level
// security admits no other Person to it, and it holds no other grant. The queries name the verification
// as well, so a policy mistake would show as a missing row rather than a wider write.
import type { VerifiedPersons } from '../../application/ports.ts';
import { PersonId } from '../../domain/identifiers.ts';
import { parseSubject, type VerifiedPerson } from '../../domain/person.ts';
import type { Database } from './database.ts';

const SCHEMA = 'tenant_user_management';

interface VerifiedPersonRow {
  id: string;
  subject: string;
  display_name: string | null;
  email: string | null;
}

export class PostgresVerifiedPersons implements VerifiedPersons {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  async findBySubject(subject: string): Promise<VerifiedPerson | undefined> {
    const [row] = await this.#db.withoutTenant((s) =>
      s.query<VerifiedPersonRow>(
        `SELECT id, subject, display_name, email
           FROM ${SCHEMA}.person
          WHERE verification = 'identity-provider' AND subject = $1`,
        [parseSubject(subject)],
      ),
    );
    if (row === undefined) return undefined;
    return {
      verification: 'identity-provider',
      id: PersonId(row.id),
      subject: row.subject,
      displayName: row.display_name ?? undefined,
      email: row.email ?? undefined,
    };
  }

  async subjects(): Promise<readonly string[]> {
    const rows = await this.#db.withoutTenant((s) =>
      s.query<{ subject: string }>(
        `SELECT subject FROM ${SCHEMA}.person WHERE verification = 'identity-provider' ORDER BY subject`,
      ),
    );
    return rows.map((row) => row.subject);
  }

  async recordAttributes(person: VerifiedPerson): Promise<void> {
    await this.#db.withoutTenant((s) =>
      s.query(
        `UPDATE ${SCHEMA}.person SET display_name = $2, email = $3
          WHERE verification = 'identity-provider' AND id = $1`,
        [person.id, person.displayName ?? null, person.email ?? null],
      ),
    );
  }
}
