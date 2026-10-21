export type QueueSnapshot<T> = {
  data: T;
  pending: number;
  recovering: boolean;
  error: string | null;
};

type Operation<T, R> = {
  apply: (value: T) => T;
  execute: () => Promise<R>;
  commit: (value: T, result: R) => T;
  onCommit?: (result: R) => void;
};

/** Immediate UI projections, ordered durable writes, and authoritative recovery. */
export function createOptimisticQueue<T>(options: {
  initial: T;
  recover: () => Promise<T>;
  onError?: (message: string, cancelled: number) => void;
}) {
  let confirmed = options.initial;
  const jobs: Operation<T, unknown>[] = [];
  const listeners = new Set<() => void>();
  let running = false;
  let recovering = false;
  let error: string | null = null;
  let snapshot: QueueSnapshot<T> = { data: confirmed, pending: 0, recovering, error };

  function publish() {
    snapshot = {
      data: jobs.reduce((value, job) => job.apply(value), confirmed),
      pending: jobs.length,
      recovering,
      error,
    };
    listeners.forEach((listener) => listener());
  }

  async function recover() {
    recovering = true;
    publish();
    try {
      confirmed = await options.recover();
      error = null;
    } catch {
      error = "Could not confirm the saved auction state. Check your connection and press Resync before continuing.";
    } finally {
      recovering = false;
      publish();
    }
  }

  async function drain() {
    if (running) return;
    running = true;
    try {
      while (jobs.length) {
        const job = jobs[0];
        let result: unknown;
        try {
          result = await job.execute();
          confirmed = job.commit(confirmed, result);
        } catch (cause) {
          const cancelled = jobs.length - 1;
          jobs.length = 0;
          error = cause instanceof Error ? cause.message : "The auction update could not be saved.";
          // Recovery runs before another command can be accepted, including
          // after a server wrote only part of a multi-row operation.
          const recovery = recover();
          options.onError?.(error, cancelled);
          await recovery;
          return;
        }
        jobs.shift();
        publish();
        // Notifications must never make a successful database write roll back.
        try { job.onCommit?.(result); } catch { /* best-effort notification */ }
      }
    } finally {
      running = false;
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    enqueue<R>(operation: Operation<T, R>) {
      if (recovering || error) return false;
      jobs.push(operation as Operation<T, unknown>);
      publish();
      void drain();
      return true;
    },
    replace(value: T) {
      if (running || jobs.length || recovering || error) return false;
      confirmed = value;
      publish();
      return true;
    },
    async resync() {
      if (running || jobs.length || recovering) return false;
      await recover();
      return !error;
    },
  };
}
