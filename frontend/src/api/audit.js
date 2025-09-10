// src/api/audit.js
import { api } from './auth';

/**
 * Fetch audit logs with optional filters:
 * params: { entity, action, userId, from, to, limit }
 * - from/to should be ISO date strings (e.g. '2025-08-01T00:00:00Z')
 * - limit is clamped server-side (default 200, max 1000)
 *
 * Returns: Promise resolving to the JSON array returned by the server.
 */
export const fetchAuditLogs = (params = {}) => {
  const qs = new URLSearchParams();
  if (params.entity) qs.set('entity', params.entity);
  if (params.action) qs.set('action', params.action);
  if (params.userId !== undefined && params.userId !== null) qs.set('userId', String(params.userId));
  if (params.from) qs.set('from', params.from);
  if (params.to) qs.set('to', params.to);
  if (params.limit) qs.set('limit', String(params.limit));
  const q = qs.toString() ? `?${qs.toString()}` : '';
  return api(`/api/audit${q}`, 'GET');
};
