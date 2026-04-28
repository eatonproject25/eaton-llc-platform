import { buildQueuedStatusUpdateAction, buildStatusUpdatePayload } from '../../lib/statusUpdatePayload';

describe('statusUpdatePayload', () => {
  it('builds the API payload with expected_status', () => {
    expect(buildStatusUpdatePayload('completed', 'on_site', '2026-04-22T14:00:00.000Z')).toEqual({
      status: 'completed',
      expected_status: 'on_site',
      occurred_at: '2026-04-22T14:00:00.000Z',
    });
  });

  it('builds the queued action with expectedStatus', () => {
    expect(buildQueuedStatusUpdateAction(17, 'en_route', 'assigned', '2026-04-22T14:00:00.000Z')).toEqual({
      type: 'status_update',
      assignmentId: 17,
      status: 'en_route',
      expectedStatus: 'assigned',
      occurredAt: '2026-04-22T14:00:00.000Z',
    });
  });
});
