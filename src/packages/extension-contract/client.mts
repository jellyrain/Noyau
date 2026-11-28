import type { Json } from './index.js';

export class OperationError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

export async function callOperation<Result extends Json = Json>(
  module: string, operation: string, input: Json = null,
): Promise<{ data: Result; version: string }> {
  const url = '/api/modules/' + encodeURIComponent(module) + '/' + encodeURIComponent(operation);
  const response = await fetch(url, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input),
  });
  if (!response.ok) throw new OperationError(response.status, await response.text() || response.statusText);
  return response.json();
}
