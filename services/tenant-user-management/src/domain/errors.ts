// Domain errors. The core throws these and nothing else, so an adapter can tell a broken rule from a
// broken dependency without inspecting messages.

export class DomainError extends Error {
  override readonly name: string = 'DomainError';
}

export class InvalidIdentifier extends DomainError {
  override readonly name = 'InvalidIdentifier';
  readonly kind: string;

  constructor(kind: string) {
    super(`not a valid ${kind}`);
    this.kind = kind;
  }
}

export class InvariantViolated extends DomainError {
  override readonly name = 'InvariantViolated';
}
