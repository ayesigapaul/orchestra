// Application errors: a dependency the core needs has failed, as distinct from a broken domain rule
// (../domain/errors.ts). An adapter maps each to its protocol's own answer.

/** A dependency the operation needs could not be reached, so nothing was decided. Safe to retry. */
export class DependencyUnavailable extends Error {
  override readonly name = 'DependencyUnavailable';
  readonly dependency: string;

  constructor(dependency: string, options?: ErrorOptions) {
    super(`${dependency} is unavailable`, options);
    this.dependency = dependency;
  }
}
