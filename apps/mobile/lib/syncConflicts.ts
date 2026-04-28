type ApiError = {
  response?: {
    status?: number;
    data?: unknown;
  };
};

function getErrorCode(data: unknown): string {
  if (!data || typeof data !== 'object') return '';
  const code = (data as { code?: unknown }).code;
  return typeof code === 'string' ? code.toUpperCase() : '';
}

function extractErrorText(data: unknown): string {
  if (!data) return '';
  if (typeof data === 'string') return data.toLowerCase();
  if (typeof data === 'object') {
    return JSON.stringify(data).toLowerCase();
  }
  return '';
}

export function isStatusSyncConflict(err: ApiError): boolean {
  const status = err.response?.status;
  const data = err.response?.data;
  const code = getErrorCode(data);
  const text = extractErrorText(data);

  if (code === 'SYNC_CONFLICT') return true;

  // 400/409/422 can signal a rejected transition when paired with conflict-like body content.
  if (status === 400 || status === 409 || status === 422) {
    return (
      text.includes('conflict') ||
      text.includes('stale') ||
      text.includes('expected_status') ||
      text.includes('invalid transition')
    );
  }

  // Fallback for APIs that encode conflict semantics in message text.
  return (
    text.includes('conflict') ||
    text.includes('stale') ||
    text.includes('already') ||
    text.includes('invalid transition')
  );
}