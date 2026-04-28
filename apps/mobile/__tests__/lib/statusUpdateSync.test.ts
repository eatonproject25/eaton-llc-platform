import { replayQueuedStatusUpdates } from '../../lib/statusUpdateSync';

describe('replayQueuedStatusUpdates', () => {
  const queue = [
    {
      id: 'action-1',
      type: 'status_update' as const,
      assignmentId: 101,
      status: 'en_route',
      expectedStatus: 'assigned',
      occurredAt: '2026-04-05T00:00:00.000Z',
      queuedAt: '2026-04-05T00:00:00.000Z',
    },
    {
      id: 'action-2',
      type: 'status_update' as const,
      assignmentId: 102,
      status: 'completed',
      expectedStatus: 'on_site',
      occurredAt: '2026-04-05T00:01:00.000Z',
      queuedAt: '2026-04-05T00:01:00.000Z',
    },
  ];

  it('replays queued updates with expected_status and continues after conflicts', async () => {
    const conflictError = {
      response: { status: 409, data: { code: 'SYNC_CONFLICT' } },
    };
    const patchStatus = jest
      .fn()
      .mockRejectedValueOnce(conflictError)
      .mockResolvedValueOnce(undefined);
    const removeAction = jest.fn().mockResolvedValue(undefined);
    const onSuccess = jest.fn().mockResolvedValue(undefined);
    const onConflict = jest.fn().mockResolvedValue(undefined);
    const onTransientFailure = jest.fn();
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);

    await replayQueuedStatusUpdates(queue, {
      patchStatus,
      onSuccess,
      removeAction,
      onConflict,
      onTransientFailure,
      invalidateQueries,
    });

    expect(patchStatus).toHaveBeenNthCalledWith(1, 101, {
      status: 'en_route',
      expected_status: 'assigned',
      occurred_at: '2026-04-05T00:00:00.000Z',
    });
    expect(onConflict).toHaveBeenCalledWith(expect.objectContaining({ id: 'action-1' }), conflictError);
    expect(removeAction).toHaveBeenNthCalledWith(1, 'action-1');
    expect(patchStatus).toHaveBeenNthCalledWith(2, 102, {
      status: 'completed',
      expected_status: 'on_site',
      occurred_at: '2026-04-05T00:01:00.000Z',
    });
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(expect.objectContaining({ id: 'action-2' }), undefined);
    expect(removeAction).toHaveBeenNthCalledWith(2, 'action-2');
    expect(onTransientFailure).not.toHaveBeenCalled();
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });

  it('stops replaying after a transient failure and keeps remaining queue items', async () => {
    const transientError = {
      response: { status: 503, data: { detail: 'Service unavailable' } },
    };
    const patchStatus = jest.fn().mockRejectedValueOnce(transientError);
    const removeAction = jest.fn().mockResolvedValue(undefined);
    const onSuccess = jest.fn();
    const onConflict = jest.fn();
    const onTransientFailure = jest.fn();
    const invalidateQueries = jest.fn().mockResolvedValue(undefined);

    await replayQueuedStatusUpdates(queue, {
      patchStatus,
      onSuccess,
      removeAction,
      onConflict,
      onTransientFailure,
      invalidateQueries,
    });

    expect(patchStatus).toHaveBeenCalledTimes(1);
    expect(removeAction).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onConflict).not.toHaveBeenCalled();
    expect(onTransientFailure).toHaveBeenCalledWith(expect.objectContaining({ id: 'action-1' }), transientError);
    expect(invalidateQueries).toHaveBeenCalledTimes(1);
  });
});
