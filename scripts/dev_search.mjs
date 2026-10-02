/** One current search index at a time, after generation and Angular compilation. */
export class DevelopmentSearch {
  constructor(build, { ready = () => {}, failed = () => {}, delay = 200 } = {}) {
    this.build = build;
    this.ready = ready;
    this.failed = failed;
    this.delay = delay;
    this.dirty = true;
  }

  invalidate(waitForCompilation = false) {
    this.dirty = true;
    this.abort?.abort();
    if (waitForCompilation) this.compilationReady = false;
    this.schedule();
  }

  listening() { this.serverReady = true; this.schedule(); }
  compiling() {
    this.compilationReady = false;
    this.invalidate();
  }
  compiled() { this.compilationReady = true; this.schedule(); }
  generating() { this.generationReady = false; this.schedule(); }
  generated(success) { this.generationReady = success; this.schedule(); }

  schedule() {
    clearTimeout(this.timer);
    if (this.closed || !this.serverReady || !this.compilationReady || !this.generationReady || !this.dirty || this.job) return;
    this.timer = setTimeout(() => {
      this.dirty = false;
      const abort = this.abort = new AbortController();
      this.job = Promise.resolve().then(() => this.build(abort.signal))
        .then(result => { if (!abort.signal.aborted) this.ready(result); })
        .catch(error => { if (!abort.signal.aborted) this.failed(error); })
        .finally(() => { this.job = undefined; this.schedule(); });
    }, this.delay);
  }

  async stop() {
    this.closed = true;
    clearTimeout(this.timer);
    this.abort?.abort();
    await this.job;
  }
}
