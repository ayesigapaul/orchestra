import { InvariantViolated } from '../domain/errors.ts';
import { recordIdentityProviderAttributes, type VerifiedPerson } from '../domain/person.ts';
import type { IdentityProviderUsers, VerifiedPersons } from './ports.ts';

/** What one synchronization did. For the log: it names no attribute, only the kind of outcome. */
export type SyncOutcome =
  | 'recorded'
  | 'unchanged'
  | 'unknown-person'
  | 'unknown-to-identity-provider'
  | 'invalid-attributes';

export interface IdentitySyncDependencies {
  readonly persons: VerifiedPersons;
  readonly identityProvider: IdentityProviderUsers;
}

/**
 * Records what the identity provider holds about one verified subject on its Person, through the
 * domain rule that accepts a verified Person and nothing else (ADR-0024). The identity provider is the
 * only source: an email it no longer holds as verified is cleared, and a subject it no longer knows is
 * left as it is, because erasing a Person is a separate design. An identity provider that cannot be
 * reached throws DependencyUnavailable, and nothing is recorded.
 */
export function synchronizeIdentity(deps: IdentitySyncDependencies) {
  return async (subject: string): Promise<SyncOutcome> => {
    const person = await deps.persons.findBySubject(subject);
    if (person === undefined) return 'unknown-person';
    const attributes = await deps.identityProvider.attributesOf(person.subject);
    if (attributes === undefined) return 'unknown-to-identity-provider';

    let updated: VerifiedPerson;
    try {
      updated = recordIdentityProviderAttributes(person, attributes);
    } catch (error) {
      if (error instanceof InvariantViolated) return 'invalid-attributes';
      throw error;
    }
    if (updated.displayName === person.displayName && updated.email === person.email) return 'unchanged';
    await deps.persons.recordAttributes(updated);
    return 'recorded';
  };
}

/** Synchronizes every verified Person in turn, and counts what happened to them. */
export function synchronizeIdentities(deps: IdentitySyncDependencies) {
  const synchronize = synchronizeIdentity(deps);
  return async (): Promise<Record<SyncOutcome, number>> => {
    const counts: Record<SyncOutcome, number> = {
      recorded: 0,
      unchanged: 0,
      'unknown-person': 0,
      'unknown-to-identity-provider': 0,
      'invalid-attributes': 0,
    };
    for (const subject of await deps.persons.subjects()) {
      counts[await synchronize(subject)] += 1;
    }
    return counts;
  };
}
