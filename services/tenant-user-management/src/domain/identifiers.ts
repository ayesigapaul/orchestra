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

function parse<B extends string>(value: string, kind: B): Brand<B> {
  const normalised = value.trim().toLowerCase();
  if (!UUID.test(normalised)) throw new InvalidIdentifier(kind);
  return normalised as Brand<B>;
}

export const TenantId = (value: string): TenantId => parse(value, 'TenantId');
export const PersonId = (value: string): PersonId => parse(value, 'PersonId');
export const MembershipId = (value: string): MembershipId => parse(value, 'MembershipId');
export const PrincipalId = (value: string): PrincipalId => parse(value, 'PrincipalId');
