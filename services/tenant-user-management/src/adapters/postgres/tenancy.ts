// PostgreSQL adapters for the tenancy ports, over the schema in db/migrations. Row-level security
// scopes every read to the transaction's Tenant, and Persons and Memberships are written only through
// the linking functions, which is what ADR-0024 relies on. The queries name their Tenant as well, so
// a policy mistake would show as a missing row rather than a wider read.
import type {
  PersonLinker,
  PrincipalRepository,
  TenantDirectory,
  TenantDirectoryEntry,
} from '../../application/ports.ts';
import { MembershipId, PersonId, PrincipalId, TenantId } from '../../domain/identifiers.ts';
import type { Membership } from '../../domain/membership.ts';
import { parseSubject } from '../../domain/person.ts';
import type { PlatformUser } from '../../domain/principal.ts';
import type { Database } from './database.ts';

const SCHEMA = 'tenant_user_management';

export class PostgresTenantDirectory implements TenantDirectory {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  async findByIdentityProviderOrganization(organization: string): Promise<TenantDirectoryEntry | undefined> {
    // The directory is read before any tenant context exists (multi-tenancy.md section 7).
    const [row] = await this.#db.withoutTenant((s) =>
      s.query<{ tenant_id: string; status: 'active' | 'suspended'; identity_provider_organization: string }>(
        `SELECT tenant_id, status, identity_provider_organization
           FROM ${SCHEMA}.tenant_directory
          WHERE identity_provider_organization = $1`,
        [organization],
      ),
    );
    if (row === undefined) return undefined;
    return {
      tenantId: TenantId(row.tenant_id),
      status: row.status,
      identityProviderOrganization: row.identity_provider_organization,
    };
  }
}

type LinkingFunction = 'link_verified_person' | 'link_asserted_person';

export class PostgresTenancy implements PersonLinker, PrincipalRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  linkVerified(tenantId: TenantId, verifiedSubject: string): Promise<Membership> {
    return this.#link(tenantId, 'link_verified_person', verifiedSubject);
  }

  linkAsserted(tenantId: TenantId, assertedSubject: string): Promise<Membership> {
    return this.#link(tenantId, 'link_asserted_person', assertedSubject);
  }

  async findPlatformUserByVerifiedSubject(tenantId: TenantId, subject: string): Promise<PlatformUser | undefined> {
    const [row] = await this.#db.inTenant(tenantId, (s) =>
      s.query<{ id: string; membership_id: string }>(
        `SELECT pr.id, pr.membership_id
           FROM ${SCHEMA}.principal pr
           JOIN ${SCHEMA}.membership m ON m.tenant_id = pr.tenant_id AND m.id = pr.membership_id
           JOIN ${SCHEMA}.person p ON p.id = m.person_id
          WHERE pr.tenant_id = $1
            AND pr.kind = 'platform-user'
            AND p.verification = 'identity-provider'
            AND p.subject = $2`,
        [tenantId, subject],
      ),
    );
    if (row === undefined) return undefined;
    return {
      kind: 'platform-user',
      tenantId,
      id: PrincipalId(row.id),
      membershipId: MembershipId(row.membership_id),
    };
  }

  async #link(tenantId: TenantId, linking: LinkingFunction, subject: string): Promise<Membership> {
    const [row] = await this.#db.inTenant(tenantId, (s) =>
      s.query<{ membership_id: string; person_id: string }>(
        `SELECT membership_id, person_id FROM ${SCHEMA}.${linking}($1)`,
        [parseSubject(subject)],
      ),
    );
    if (row === undefined) throw new Error(`${linking} returned no Membership`);
    return { tenantId, id: MembershipId(row.membership_id), personId: PersonId(row.person_id) };
  }
}
