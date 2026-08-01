export class DomainValidationError extends Error {
  readonly code: string;
  readonly field?: string;

  constructor(code: string, message: string, field?: string) {
    super(message);
    this.name = "DomainValidationError";
    this.code = code;
    this.field = field;
  }
}
