import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearQueue, enqueueAction, getQueue, removeAction } from '../../lib/offlineQueue';

const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => {
      mockStorage.delete(key);
    }),
  },
}));

describe('offlineQueue', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
  });

  it('stores expectedStatus when enqueueing a status update', async () => {
    await enqueueAction({
      type: 'status_update',
      assignmentId: 42,
      status: 'en_route',
      expectedStatus: 'assigned',
      occurredAt: '2026-04-22T14:00:00.000Z',
    });

    const queue = await getQueue();

    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      type: 'status_update',
      assignmentId: 42,
      status: 'en_route',
      expectedStatus: 'assigned',
      occurredAt: '2026-04-22T14:00:00.000Z',
    });

    expect((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]).toContain('"expectedStatus":"assigned"');
    expect((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]).toContain('"occurredAt":"2026-04-22T14:00:00.000Z"');
  });

  it('removes a single queued action by id', async () => {
    await enqueueAction({
      type: 'status_update',
      assignmentId: 1,
      status: 'en_route',
      expectedStatus: 'assigned',
      occurredAt: '2026-04-22T14:00:00.000Z',
    });
    await enqueueAction({
      type: 'status_update',
      assignmentId: 2,
      status: 'completed',
      expectedStatus: 'on_site',
      occurredAt: '2026-04-22T14:10:00.000Z',
    });

    const queue = await getQueue();
    await removeAction(queue[0].id);

    const remaining = await getQueue();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].type).toBe('status_update');
    if (remaining[0].type !== 'status_update') {
      throw new Error('Expected remaining queued action to be a status update');
    }
    expect(remaining[0].assignmentId).toBe(2);
  });

  it('clears the queue', async () => {
    await enqueueAction({
      type: 'status_update',
      assignmentId: 7,
      status: 'completed',
      expectedStatus: 'on_site',
      occurredAt: '2026-04-22T14:00:00.000Z',
    });

    await clearQueue();

    expect(await getQueue()).toEqual([]);
  });
});
