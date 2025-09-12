import { api } from "./auth"; // your existing auth.js wrapper

// Get all groups for a user
export const fetchUserGroups = (userId) => {
  return api(`/api/user-groups/user/${userId}`, "GET");
};


// Fetch all users in a group
export const fetchGroupUsers = async (groupId) => {
  try {
    const response = await api(`/api/user-groups/${groupId}/users`);
    return response;
  } catch (error) {
    console.error('Error fetching group users:', error);
    throw error;
  }
};

// Add a user to a group
/**
 * Add a user to a group
 * @param {number} groupId - ID of the group
 * @param {number} userId - ID of the user
 */
export const addUserToGroup = async (groupId, userId) => {
  try {
    // POST to the correct route with both IDs in the body
    const response = await api("/api/user-groups", "POST", {
      groupId,
      userId,
    });
    return response;
  } catch (err) {
    console.error("Error adding user to group:", err);
    throw err;
  }
};

// Remove a user from a group
export const removeUserFromGroup = async (groupId, userId) => {
  try {
    const response = await api("/api/user-groups", "DELETE", {
      groupId,
      userId,
    });
    return response;
  } catch (err) {
    console.error('Error removing user from group:', err);
    throw err;
  }
};
