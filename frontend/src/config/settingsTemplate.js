// src/config/settingsTemplate.js
export const templateSettings = [
  { key: 'max_attachment_size_mb', value: 10, description: 'Max attachment upload size (MB)' },
  { key: 'allowed_attachment_types', value: ['application/pdf','image/png','image/jpeg','text/plain'], description: 'Allowed MIME types' },
  { key: 'reporting_active', value: true, description: 'Enable report submissions' },
  { key: 'resubmission_deadline_days', value: 7, description: 'Days to resubmit rejected reports' },
  { key: 'audit_retention_days', value: 365, description: 'Days to retain audit logs' }
];
