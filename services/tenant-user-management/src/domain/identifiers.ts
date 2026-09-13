// Identifiers are branded strings, so a PersonId cannot be passed where a TenantId is expected. The
// domain parses them itself rather than depending on a validation library.
import { InvalidIdentifier } from './errors.ts';

declare const brand: unique symbol;
type Brand<B extends string> = string & { readonly [brand]: B };

export type TenantId = Brand<'TenantId'>;
export type PersonId = Brand<'PersonId'>;
export type MembershipId = Brand<'MembershipId'>;
export type PrincipalId = Brand<'PrincipalId'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * RFC 9562's Nil UUID. Telemetry carries it for work that belongs to no Tenant (ADR-0028), so no
 * Tenant may have it as its identifier.
 */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

function parse<B extends string>(value: string, kind: B): Brand<B> {
  const normalised = value.trim().toLowerCase();
  if (!UUID.test(normalised)) throw new InvalidIdentifier(kind);
  return normalised as Brand<B>;
}

export const TenantId = (value: string): TenantId => {
  const id = parse(value, 'TenantId');
  if (id === NIL_UUID) throw new InvalidIdentifier('TenantId');
  return id;
};
export const PersonId = (value: string): PersonId => parse(value, 'PersonId');
export const MembershipId = (value: string): MembershipId => parse(value, 'MembershipId');
export const PrincipalId = (value: string): PrincipalId => parse(value, 'PrincipalId');
