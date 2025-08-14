import { api } from './auth';

export const getMySettings = () => api('/settings/me', 'GET');
export const updateMySettings = (settings) => api('/settings/me', 'PUT', settings);