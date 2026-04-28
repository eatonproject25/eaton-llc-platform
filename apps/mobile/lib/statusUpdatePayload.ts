import type { DistributiveOmit, QueuedAction } from './offlineQueue';

export type StatusUpdatePayload = {
  status: string;
  expected_status: string;
  occurred_at: string;
};

export function buildStatusUpdatePayload(
  status: string,
  expectedStatus: string,
  occurredAt: string
): StatusUpdatePayload {
  return {
    status,
    expected_status: expectedStatus,
    occurred_at: occurredAt,
  };
}

export function buildQueuedStatusUpdateAction(
  assignmentId: number,
  status: string,
  expectedStatus: string,
  occurredAt: string
): DistributiveOmit<QueuedAction, 'id' | 'queuedAt'> {
  return {
    type: 'status_update',
    assignmentId,
    status,
    expectedStatus,
    occurredAt,
  };
}
