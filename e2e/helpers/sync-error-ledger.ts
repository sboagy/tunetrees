/** Per-test failure accounting. A later request AND completed sync must prove recovery. */
export class SyncErrorLedger {
  private sequence = 0;
  private completedSequence = -1;
  private readonly failures = new Map<
    string,
    { message: string; sequence: number; deadline: number; retried: boolean }
  >();
  private readonly expired: string[] = [];

  private readonly recoveryMs: number;

  constructor(recoveryMs = 30000) {
    this.recoveryMs = recoveryMs;
  }

  startRequest(): number {
    return ++this.sequence;
  }

  fail(key: string, message: string, now = Date.now()): void {
    this.expire(now);
    const previous = this.failures.get(key);
    this.failures.set(key, {
      message,
      sequence: ++this.sequence,
      deadline: previous?.deadline ?? now + this.recoveryMs,
      retried: key === "console" || key.startsWith("console:"),
    });
  }

  requestFinished(): number {
    return ++this.sequence;
  }

  dismissExpected(key: string): void {
    this.failures.delete(key);
  }

  requestSucceeded(
    key: string,
    started: number,
    finished: number,
    now = Date.now()
  ): void {
    this.expire(now);
    const failure = this.failures.get(key);
    if (failure && started > failure.sequence) {
      failure.retried = true;
      // Response-body parsing can finish after the browser reports completion.
      if (this.completedSequence >= finished) this.failures.delete(key);
    }
  }

  completedSync(now = Date.now()): void {
    this.expire(now);
    this.completedSequence = ++this.sequence;
    for (const [key, failure] of this.failures) {
      if (failure.retried) this.failures.delete(key);
    }
  }

  problems(now = Date.now()): string[] {
    this.expire(now);
    return [
      ...this.expired,
      ...Array.from(this.failures.values(), (f) => f.message),
    ];
  }

  private expire(now: number): void {
    for (const [key, failure] of this.failures) {
      if (now >= failure.deadline) {
        this.expired.push(`Recovery deadline exceeded: ${failure.message}`);
        this.failures.delete(key);
      }
    }
  }
}
