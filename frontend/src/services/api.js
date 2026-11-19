export const browserStorage = import.meta.env.VITE_STORAGE_MODE === 'browser';
async function request(path, options) {
  if (browserStorage) {
    const { browserFetch } = await import('./browser-api');
    return browserFetch(path, options);
  }
  return fetch(`${API}${path}`, options);
}
export const API = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');
export function query(values) {
  return new URLSearchParams(
    Object.entries(values).filter(([, value]) => value !== '' && value != null),
  ).toString();
}
export async function api(path, options = {}) {
  const response = await request(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Unable to reach SpendWise. Please try again.');
  }
  return response.status === 204 ? null : response.json();
}
export async function exportCsv(filters) {
  const response = await request(`/transactions/export?${query(filters)}`);
  if (!response.ok) throw new Error('Could not export transactions. Please try again.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = 'spendwise-transactions.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
