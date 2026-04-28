import { isStatusSyncConflict } from '../../lib/syncConflicts';

describe('isStatusSyncConflict', () => {
  it('detects backend SYNC_CONFLICT responses', () => {
    expect(
      isStatusSyncConflict({
        response: {
          status: 409,
          data: { code: 'SYNC_CONFLICT' },
        },
      })
    ).toBe(true);
  });

  it('detects conflict-like rejection bodies on 400/422 responses', () => {
    expect(
      isStatusSyncConflict({
        response: {
          status: 422,
          data: { detail: 'expected_status does not match current status' },
        },
      })
    ).toBe(true);
  });

  it('does not flag transient failures as conflicts', () => {
    expect(
      isStatusSyncConflict({
        response: {
          status: 503,
          data: { detail: 'Service unavailable' },
        },
      })
    ).toBe(false);
  });
});
