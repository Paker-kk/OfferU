export type FillFailureReason =
  | "no_match"
  | "write_blocked"
  | "verify_failed"
  | "control_not_supported"
  | "validation_error"
  | "aborted"
  | "disabled"
  | "not_found"
  | "readonly";

export class SmartFillError extends Error {
  constructor(
    message: string,
    public readonly code: FillFailureReason,
    public readonly fieldId?: string,
  ) {
    super(message);
    this.name = "SmartFillError";
  }
}

export class FieldRecoveryError extends SmartFillError {
  constructor(
    message: string,
    public readonly recoverySteps: string[],
    fieldId?: string,
  ) {
    super(message, "write_blocked", fieldId);
    this.name = "FieldRecoveryError";
  }
}

export class AbortError extends SmartFillError {
  constructor() {
    super("Operation was aborted", "aborted");
    this.name = "AbortError";
  }
}
