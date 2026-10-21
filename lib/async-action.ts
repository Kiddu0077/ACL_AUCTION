/** One in-flight mutation per control, including clicks before React re-renders. */
export function createActionRunner(onPending: (pending: boolean) => void) {
  let active = false;
  return async (
    action: () => Promise<void>,
    onError: (error: unknown) => void,
  ): Promise<void> => {
    if (active) return;
    active = true;
    onPending(true);
    try {
      await action();
    } catch (error) {
      onError(error);
    } finally {
      active = false;
      onPending(false);
    }
  };
}
