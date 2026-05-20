export class PipelineAbortController {
  private controller: AbortController;
  private aborted: boolean = false;

  constructor() {
    this.controller = new AbortController();
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  get isAborted(): boolean {
    return this.aborted;
  }

  abort(): void {
    this.aborted = true;
    this.controller.abort();
  }

  throwIfAborted(): void {
    if (this.aborted) {
      throw new Error("Pipeline aborted");
    }
  }
}
