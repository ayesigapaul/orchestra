// In-memory adapters for the tenancy ports. They back the core's tests and a local run without a
// database, and they enforce what ADR-0024 asks of the PostgreSQL adapter: a Tenant sees a Person
// only through its own Membership, verified subjects join across Tenants, asserted ones never do,
// and global attributes arrive only through the identity-provider path.
import { randomUUID } from 'node:crypto';
import { MembershipId, PersonId, type PrincipalId, type TenantId } from '../../domain/identifiers.ts';
import { membershipFor, type Membership } from '../../domain/membership.ts';
import {
  assertedPerson,
  recordIdentityProviderAttributes,
  verifiedPerson,
  type IdentityProviderAttributes,
  type Person,
} from '../../domain/person.ts';
import { platformUserFor, type PlatformUser } from '../../domain/principal.ts';
import type {
  PersonLinker,
  PrincipalRepository,
  TenantDirectory,
  TenantDirectoryEntry,
} from '../../application/ports.ts';

export class InMemoryTenantDirectory implements TenantDirectory {
  readonly #byOrganization = new Map<string, TenantDirectoryEntry>();

  add(entry: TenantDirectoryEntry): void {
    this.#byOrganization.set(entry.identityProviderOrganization, entry);
  }

  async findByIdentityProviderOrganization(organization: string): Promise<TenantDirectoryEntry | undefined> {
    return this.#byOrganization.get(organization);
  }
}

export class InMemoryTenancy implements PersonLinker, PrincipalRepository {
  readonly #persons = new Map<PersonId, Person>();
  readonly #memberships = new Map<TenantId, Map<PersonId, Membership>>();
  readonly #platformUsers = new Map<TenantId, Map<MembershipId, PlatformUser>>();
  readonly #newId: () => string;

  constructor(newId: () => string = randomUUID) {
    this.#newId = newId;
  }

  async linkVerified(tenantId: TenantId, verifiedSubject: string): Promise<Membership> {
    const existing = this.#find((p) => p.verification === 'identity-provider' && p.subject === verifiedSubject);
    return this.#join(existing ?? this.#store(verifiedPerson(PersonId(this.#newId()), verifiedSubject)), tenantId);
  }

  async linkAsserted(tenantId: TenantId, assertedSubject: string): Promise<Membership> {
    const existing = this.#find(
      (p) => p.verification === 'tenant-asserted' && p.subject === assertedSubject && p.assertingTenantId === tenantId,
    );
    const person = existing ?? this.#store(assertedPerson(PersonId(this.#newId()), tenantId, assertedSubject));
    return this.#join(person, tenantId);
  }

  /** The identity-sync path: the only way a Person gains a name or an email. */
  recordIdentityProviderAttributes(verifiedSubject: string, attributes: IdentityProviderAttributes): void {
    const person = this.#find((p) => p.verification === 'identity-provider' && p.subject === verifiedSubject);
    if (person?.verification !== 'identity-provider') return;
    this.#store(recordIdentityProviderAttributes(person, attributes));
  }

  /** What one Tenant can see of the global Person table: exactly the Persons it holds a Membership for. */
  personsVisibleTo(tenantId: TenantId): Person[] {
    return [...(this.#memberships.get(tenantId)?.values() ?? [])].flatMap((m) => this.#persons.get(m.personId) ?? []);
  }

  membershipsVisibleTo(tenantId: TenantId): Membership[] {
    return [...(this.#memberships.get(tenantId)?.values() ?? [])];
  }

  addPlatformUser(membership: Membership, id: PrincipalId): PlatformUser {
    const person = this.#persons.get(membership.personId);
    if (person === undefined) throw new Error('no Person for this Membership');
    const user = platformUserFor(membership, person, id);
    const tenant = this.#platformUsers.get(user.tenantId) ?? new Map<MembershipId, PlatformUser>();
    tenant.set(user.membershipId, user);
    this.#platformUsers.set(user.tenantId, tenant);
    return user;
  }

  async findPlatformUserByVerifiedSubject(tenantId: TenantId, subject: string): Promise<PlatformUser | undefined> {
    const person = this.personsVisibleTo(tenantId).find(
      (p) => p.verification === 'identity-provider' && p.subject === subject,
    );
    if (person === undefined) return undefined;
    const membership = this.#memberships.get(tenantId)?.get(person.id);
    return membership === undefined ? undefined : this.#platformUsers.get(tenantId)?.get(membership.id);
  }

  #find(predicate: (person: Person) => boolean): Person | undefined {
    return [...this.#persons.values()].find(predicate);
  }

  #store(person: Person): Person {
    this.#persons.set(person.id, person);
    return person;
  }

  #join(person: Person, tenantId: TenantId): Membership {
    const tenant = this.#memberships.get(tenantId) ?? new Map<PersonId, Membership>();
    const membership = tenant.get(person.id) ?? membershipFor(person, tenantId, MembershipId(this.#newId()));
    tenant.set(person.id, membership);
    this.#memberships.set(tenantId, tenant);
    return membership;
  }
}
