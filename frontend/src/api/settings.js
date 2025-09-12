import { api } from './auth';

// -------------------- SETTINGS --------------------

// Get current user settings
export const getMySettings = () => {
  return api('/api/settings', 'GET'); // matches backend GET /api/settings
};

// Update user settings (name, language, darkMode, optional password)
export const updateMySettings = (settings) => {
  return api('/api/settings', 'PUT', settings); // matches backend PUT /api/settings
};

// -------------------- PROFILE PICTURE --------------------

// Update profile picture
export const updateProfilePicture = (file) => {
  const formData = new FormData();
  formData.append('file', file);

  // Some api helpers may need a flag to skip JSON headers
  return api('/api/settings/profile-picture', 'PUT', formData, { isFormData: true });
};
