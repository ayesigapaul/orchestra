import { InMemoryTenancy, InMemoryTenantDirectory } from '../../../src/adapters/in-memory/tenancy.ts';
import { describeTenancyAdapter, type TenancyHarness } from '../tenancy-contract.ts';

describeTenancyAdapter('InMemoryTenancy', (): TenancyHarness => {
  const tenancy = new InMemoryTenancy();
  const directory = new InMemoryTenantDirectory();
  return {
    linker: tenancy,
    principals: tenancy,
    directory,
    addTenant: async (entry) => directory.add(entry),
    addPlatformUser: async (membership, id) => tenancy.addPlatformUser(membership, id),
    verifiedPersons: tenancy,
    personsVisibleTo: async (tenantId) => tenancy.personsVisibleTo(tenantId),
    membershipsVisibleTo: async (tenantId) => tenancy.membershipsVisibleTo(tenantId),
  };
});
