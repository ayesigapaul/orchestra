// The properties ADR-0024 requires of every tenancy adapter. The in-memory adapter and the PostgreSQL
// adapter both run them, so neither can drift from the other or from the ADR. Every case makes its
// own Tenants and subjects, so the suite also runs against a database that outlives it.
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type {
  PersonLinker,
  PrincipalRepository,
  TenantDirectory,
  TenantDirectoryEntry,
} from '../../src/application/ports.ts';
import { PrincipalId, TenantId } from '../../src/domain/identifiers.ts';
import type { Membership } from '../../src/domain/membership.ts';
import type { IdentityProviderAttributes, Person } from '../../src/domain/person.ts';
import type { PlatformUser } from '../../src/domain/principal.ts';

/** The ports under test, and the fixture operations no port offers. */
export interface TenancyHarness {
  readonly linker: PersonLinker;
  readonly principals: PrincipalRepository;
  readonly directory: TenantDirectory;
  addTenant(entry: TenantDirectoryEntry): Promise<void>;
  addPlatformUser(membership: Membership, id: PrincipalId): Promise<PlatformUser>;
  recordIdentityProviderAttributes(subject: string, attributes: IdentityProviderAttributes): Promise<void>;
  personsVisibleTo(tenantId: TenantId): Promise<Person[]>;
  membershipsVisibleTo(tenantId: TenantId): Promise<Membership[]>;
}

const newTenant = () => TenantId(randomUUID());
const newSubject = (name: string) => `${name}-${randomUUID()}`;

export function describeTenancyAdapter(name: string, harness: () => TenancyHarness): void {
  describe(name, () => {
    it('shows a Tenant no Person until it holds a Membership', async () => {
      const h = harness();
      const [a, b] = [newTenant(), newTenant()];
      await h.linker.linkVerified(a, newSubject('ada'));
      expect(await h.personsVisibleTo(a)).toHaveLength(1);
      expect(await h.personsVisibleTo(b)).toHaveLength(0);
    });

    it('gives two Tenants that link the same verified subject one shared Person', async () => {
      const h = harness();
      const ada = newSubject('ada');
      const inA = await h.linker.linkVerified(newTenant(), ada);
      const inB = await h.linker.linkVerified(newTenant(), ada);
      expect(inA.personId).toBe(inB.personId);
      expect(inA.id).not.toBe(inB.id);
    });

    it('shows each Tenant only its own Memberships', async () => {
      const h = harness();
      const [a, b] = [newTenant(), newTenant()];
      const ada = newSubject('ada');
      await h.linker.linkVerified(a, ada);
      await h.linker.linkVerified(b, ada);
      expect((await h.membershipsVisibleTo(a)).map((m) => m.tenantId)).toEqual([a]);
    });

    it('never merges an asserted End User across Tenants', async () => {
      const h = harness();
      const [a, b] = [newTenant(), newTenant()];
      const customer = newSubject('customer');
      const inA = await h.linker.linkAsserted(a, customer);
      const inB = await h.linker.linkAsserted(b, customer);
      expect(inA.personId).not.toBe(inB.personId);
      expect((await h.personsVisibleTo(b)).map((p) => p.id)).toEqual([inB.personId]);
    });

    it('does not let an asserted subject claim a verified Person', async () => {
      const h = harness();
      const ada = newSubject('ada');
      const verified = await h.linker.linkVerified(newTenant(), ada);
      const asserted = await h.linker.linkAsserted(newTenant(), ada);
      expect(asserted.personId).not.toBe(verified.personId);
    });

    it('shows every Tenant the identity provider’s attributes, and none a Tenant supplied', async () => {
      const h = harness();
      const b = newTenant();
      const ada = newSubject('ada');
      await h.linker.linkVerified(newTenant(), ada);
      await h.recordIdentityProviderAttributes(ada, { displayName: 'Ada Lovelace', email: 'ada@example.com' });
      await h.linker.linkVerified(b, ada);
      expect(await h.personsVisibleTo(b)).toEqual([
        expect.objectContaining({ displayName: 'Ada Lovelace', email: 'ada@example.com' }),
      ]);
    });

    it('is idempotent: linking twice keeps one Membership', async () => {
      const h = harness();
      const a = newTenant();
      const ada = newSubject('ada');
      const first = await h.linker.linkVerified(a, ada);
      const second = await h.linker.linkVerified(a, ada);
      expect(second.id).toBe(first.id);
    });

    it('finds a Platform User by verified subject in its own Tenant, and in no other', async () => {
      const h = harness();
      const [a, b] = [newTenant(), newTenant()];
      const bea = newSubject('bea');
      const user = await h.addPlatformUser(await h.linker.linkVerified(a, bea), PrincipalId(randomUUID()));
      await h.linker.linkVerified(b, bea);
      expect(await h.principals.findPlatformUserByVerifiedSubject(a, bea)).toEqual(user);
      expect(await h.principals.findPlatformUserByVerifiedSubject(b, bea)).toBeUndefined();
    });

    it('finds a Tenant by its identity-provider organization, and nothing for an unknown one', async () => {
      const h = harness();
      const entry: TenantDirectoryEntry = {
        tenantId: newTenant(),
        status: 'active',
        identityProviderOrganization: newSubject('org'),
      };
      await h.addTenant(entry);
      expect(await h.directory.findByIdentityProviderOrganization(entry.identityProviderOrganization)).toEqual(entry);
      expect(await h.directory.findByIdentityProviderOrganization(newSubject('org'))).toBeUndefined();
    });
  });
}
