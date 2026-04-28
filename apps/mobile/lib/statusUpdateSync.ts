import type { QueuedAction } from './offlineQueue';
import { buildStatusUpdatePayload } from './statusUpdatePayload';
import { isStatusSyncConflict } from './syncConflicts';

type ReplayAction = Extract<QueuedAction, { type: 'status_update' }>;

type ReplayDependencies = {
  patchStatus: (
    assignmentId: number,
    payload: ReturnType<typeof buildStatusUpdatePayload>
  ) => Promise<unknown>;
  onSuccess: (action: ReplayAction, response: unknown) => void | Promise<void>;
  removeAction: (id: string) => Promise<void>;
  onConflict: (action: ReplayAction, error: unknown) => void | Promise<void>;
  onTransientFailure: (action: ReplayAction, error: unknown) => void;
  invalidateQueries: () => Promise<void>;
};

export async function replayQueuedStatusUpdates(
  queue: QueuedAction[],
  dependencies: ReplayDependencies
): Promise<void> {
  for (const action of queue) {
    if (action.type !== 'status_update') continue;

    try {
      const response = await dependencies.patchStatus(
        action.assignmentId,
        buildStatusUpdatePayload(action.status, action.expectedStatus, action.occurredAt)
      );
      await dependencies.onSuccess(action, response);
      await dependencies.removeAction(action.id);
    } catch (error) {
      if (isStatusSyncConflict(error as { response?: { status?: number; data?: unknown } })) {
        await dependencies.onConflict(action, error);
        await dependencies.removeAction(action.id);
        continue;
      }

      dependencies.onTransientFailure(action, error);
      break;
    }
  }

  await dependencies.invalidateQueries();
}