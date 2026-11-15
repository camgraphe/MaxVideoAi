/** A returned file cannot satisfy the tool's measured-media contract. No raw probe output is public. */
export class ToolMediaValidationError extends Error {
  constructor(message: string) { super(message); this.name = 'ToolMediaValidationError'; }
}
