import { api } from './auth';

export const getMySettings = () => api('/api/settings/me', 'GET');
export const updateMySettings = (settings) => api('/api/settings/me', 'PUT', settings);