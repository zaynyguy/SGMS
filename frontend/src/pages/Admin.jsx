import React, { useState, useEffect, Component } from 'react';
import { useForm } from 'react-hook-form'; // Import useForm
import { Edit, Trash, Plus, UserPlus, Settings, Shield, ChevronDown, CheckCircle, XCircle, Info, AlertTriangle, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';


// Error Boundary Component
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ error: error, errorInfo: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-100 text-red-800 p-4">
          <div className="text-center">
            <AlertTriangle size={48} className="mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">Something went wrong.</h1>
            <p className="mb-4">We're sorry for the inconvenience. Please try refreshing the page.</p>
            {this.state.error && (
              <details className="mt-4 p-2 bg-red-50 rounded text-sm text-left">
                <summary>Error Details</summary>
                <pre className="whitespace-pre-wrap break-all">
                  {this.state.error.toString()}
                  <br />
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-6 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main Admin Component
const Admin = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null); // State for toast notifications
  const { t } = useTranslation();

  const tabs = [
    { id: 'users', name: 'Users' },
    { id: 'roles', name: 'Roles & Permissions' },
    { id: 'settings', name: 'Settings' }, // Renamed from System Settings
    { id: 'auditLog', name: 'Audit Log' }, // New tab for Audit Log
  ];

  const handleTabChange = (tabId, event) => { // Added event parameter
    if (event) {
      event.preventDefault(); // Prevent default anchor link behavior
    }
    setActiveTab(tabId);
    setIsMobileMenuOpen(false); // Close dropdown on tab selection
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    const timer = setTimeout(() => {
      setToast(null);
    }, 3000); // Toast disappears after 3 seconds
    return () => clearTimeout(timer);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-inter">
      {/* Header Bar (Placeholder for global shell) */}
      <header className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10 p-4 flex items-center justify-between">
        <div className="text-xl font-bold">Admin Dashboard</div>
      </header>

      <div className="flex">
        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="p-4 space-y-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">

            {/* Page Title & Tabs */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h1 className="text-2xl font-semibold">Administration</h1>
              {/* Mobile Tab Dropdown */}
              <div className="relative md:hidden w-full">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="w-full flex items-center justify-between px-4 py-2 font-medium bg-gray-100 dark:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {tabs.find(tab => tab.id === activeTab)?.name} <ChevronDown size={16} />
                </button>
                {isMobileMenuOpen && (
                  <ul className="absolute z-10 w-full bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg mt-1">
                    {tabs.map((tab) => (
                      <li key={tab.id}>
                        <a
                          href={`#${tab.id}`}
                          onClick={(e) => handleTabChange(tab.id, e)}
                          className={`block px-4 py-2 font-medium ${
                            activeTab === tab.id
                              ? 'bg-blue-500 text-white rounded-t-md'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          {tab.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Desktop Tab Navigation */}
              <ul className="hidden md:flex border-b border-gray-200 dark:border-gray-700 w-full">
                {tabs.map((tab) => (
                  <li key={tab.id} className="-mb-px mr-1">
                    <a
                      href={`#${tab.id}`}
                      onClick={(e) => handleTabChange(tab.id, e)}
                      className={`inline-block px-4 py-2 font-medium rounded-t-lg transition-colors duration-200 ${
                        activeTab === tab.id
                          ? 'border-l border-t border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400'
                          : 'border-b border-transparent text-gray-500 hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400'
                      }`}
                      role="tab"
                      aria-controls={tab.id}
                      aria-selected={activeTab === tab.id}
                    >
                      {tab.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Tab Panes */}
            {activeTab === 'users' && <UsersTab showToast={showToast} />}
            {activeTab === 'roles' && <RolesTab showToast={showToast} />}
            {activeTab === 'settings' && <SettingsTab showToast={showToast} />}
            {activeTab === 'auditLog' && <AuditLogTab showToast={showToast} />}

          </div>
        </main>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-4 right-4 p-4 rounded-md shadow-lg flex items-center space-x-2 ${
            toast.type === 'success' ? 'bg-green-500 text-white' :
            toast.type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
          }`}
          role="alert"
        >
          {toast.type === 'success' && <CheckCircle size={20} />}
          {toast.type === 'error' && <XCircle size={20} />}
          {toast.type === 'info' && <Info size={20} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

// Unified User Form Modal Component
const UserFormModal = ({ isOpen, onClose, userToEdit, onSave, showToast }) => {
  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm();
  const isEditing = !!userToEdit;

  useEffect(() => {
    if (isOpen) {
      // Reset form and set initial values when modal opens
      reset();
      if (isEditing) {
        setValue('name', userToEdit.name);
        setValue('email', userToEdit.email);
        setValue('role', userToEdit.role);
      } else {
        // Clear form for new user invite
        setValue('name', '');
        setValue('email', '');
        setValue('role', '');
      }
    }
  }, [isOpen, userToEdit, isEditing, reset, setValue]);

  const onSubmit = (data) => {
    onSave(data, isEditing, userToEdit?.id);
    onClose();
  };

  return (
    <div className={`fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 ${isOpen ? 'block' : 'hidden'}`}>
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">{isEditing ? 'Edit User' : 'Invite New User'}</h3>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <input
                type="text"
                id="name"
                className={`mt-1 block w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white ${errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                placeholder="e.g., Jane Doe"
                {...register('name', { required: 'Name is required' })}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input
                type="email"
                id="email"
                className={`mt-1 block w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white ${errors.email ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                placeholder="user@example.com"
                {...register('email', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
                    message: 'Invalid email address'
                  }
                })}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role</label>
              <select
                id="role"
                className={`mt-1 block w-full p-2 border rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white ${errors.role ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                {...register('role', { required: 'Role is required' })}
              >
                <option value="">Select a role</option>
                <option value="Project Lead">Project Lead</option>
                <option value="Admin">Admin</option>
                <option value="Clerk">Clerk</option>
              </select>
              {errors.role && <p className="text-red-500 text-sm mt-1">{errors.role.message}</p>}
            </div>
          </div>
          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors duration-200"
            >
              {isEditing ? 'Save Changes' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};


// Users Tab Component
const UsersTab = ({ showToast }) => {
  // Mock user data
  const [users, setUsers] = useState([
    { id: 1, name: 'Jane Doe', email: 'jane@acme.com', role: 'Project Lead', status: 'Active' },
    { id: 2, name: 'John Smith', email: 'john@acme.com', role: 'Clerk', status: 'Inactive' },
    { id: 3, name: 'Alice Brown', email: 'alice@acme.com', role: 'Admin', status: 'Pending' },
  ]);

  const [showUserModal, setShowUserModal] = useState(false);
  const [userToEdit, setUserToEdit] = useState(null); // null for new user, object for edit
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  
  // TODO: Use a useEffect hook to fetch users from the backend when the component mounts.
  // Example:
  // useEffect(() => {
  //   const fetchUsers = async () => {
  //     try {
  //       const response = await fetch('/api/users'); // Replace with your actual API endpoint
  //       const data = await response.json();
  //       setUsers(data); // Set the fetched data to the users state
  //     } catch (error) {
  //       console.error("Failed to fetch users:", error);
  //       showToast("Failed to load users.", "error");
  //     }
  //   };
  //   fetchUsers();
  // }, []);

  const handleOpenUserModal = (user) => {
    setUserToEdit(user);
    setShowUserModal(true);
  };

  const handleCloseUserModal = () => {
    setShowUserModal(false);
    setUserToEdit(null);
  };

  const handleSaveUser = (data, isEditing, userId) => {
    if (isEditing) {
      // TODO: Make a PUT or PATCH request to update an existing user on the backend.
      // Example:
      // const response = await fetch(`/api/users/${userId}`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data)
      // });
      setUsers(users.map(user =>
        user.id === userId
          ? { ...user, name: data.name, email: data.email, role: data.role }
          : user
      ));
      showToast(`User ${data.name} updated successfully!`, 'success');
    } else {
      // TODO: Make a POST request to create a new user on the backend.
      // Example:
      // const response = await fetch('/api/users', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data)
      // });
      const newUser = {
        id: users.length + 1,
        name: data.name,
        email: data.email,
        role: data.role,
        status: 'Pending',
      };
      setUsers([...users, newUser]);
      showToast(`User ${newUser.name} invited successfully!`, 'success');
    }
  };

  const handleDeleteClick = (user) => {
    setUserToDelete(user);
    setShowDeleteConfirmModal(true);
  };

  const confirmDelete = () => {
    // TODO: Make a DELETE request to remove the user from the backend.
    // Example:
    // const response = await fetch(`/api/users/${userToDelete.id}`, {
    //   method: 'DELETE'
    // });
    if (userToDelete) {
      setUsers(users.filter(user => user.id !== userToDelete.id));
      showToast(`User ${userToDelete.name} deleted.`, 'error');
      setShowDeleteConfirmModal(false);
      setUserToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirmModal(false);
    setUserToDelete(null);
  };

  const handleStatusToggle = (userId) => {
    // TODO: Make an API call to update the user's status on the backend.
    // This could be a PATCH or PUT request to a specific endpoint.
    setUsers(users.map(user => {
      if (user.id === userId) {
        let newStatus;
        switch (user.status) {
          case 'Active':
            newStatus = 'Inactive';
            break;
          case 'Inactive':
            newStatus = 'Pending';
            break;
          case 'Pending':
            newStatus = 'Active';
            break;
          default:
            newStatus = user.status;
        }
        showToast(`User status for ${user.name} changed to ${newStatus}.`, 'info');
        return { ...user, status: newStatus };
      }
      return user;
    }));
  };

  return (
    <section id="users" role="tabpanel" aria-labelledby="users-tab">
      {/* Invite User Button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => handleOpenUserModal(null)}
          className="btn-primary flex items-center gap-2 px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md transition-colors duration-200"
        >
          <UserPlus size={20} /> Add User
        </button>
      </div>

      {/* Users Table (Desktop View) */}
      <div className="hidden md:block overflow-x-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {users.length > 0 ? (
          <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                  <td className="px-4 py-3 whitespace-nowrap">{user.name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{user.email}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">{user.role}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <button
                      onClick={() => handleStatusToggle(user.id)}
                      className={`px-3 py-1 text-xs leading-5 font-semibold rounded-full transition-colors duration-200
                        ${user.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 hover:bg-green-200 dark:hover:bg-green-700' : ''}
                        ${user.status === 'Inactive' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100 hover:bg-red-200 dark:hover:bg-red-700' : ''}
                        ${user.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 hover:bg-yellow-200 dark:hover:bg-yellow-700' : ''}
                      `}
                      title="Click to change status"
                    >
                      {user.status}
                    </button>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center space-x-1">
                    <button
                      onClick={() => handleOpenUserModal(user)}
                      className="btn-icon p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-150"
                      title="Edit"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDeleteClick(user)}
                      className="btn-icon p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900 transition-colors duration-150"
                      title="Delete"
                    >
                      <Trash size={18} className="text-red-600 dark:text-red-400" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            <p className="mb-4">No users invited yet.</p>
            <button
              onClick={() => handleOpenUserModal(null)}
              className="btn-primary flex items-center gap-2 mx-auto px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md transition-colors duration-200"
            >
              <UserPlus size={18} /> Invite User
            </button>
          </div>
        )}
      </div>

      {/* Users Card View (Mobile View) */}
      <div className="md:hidden space-y-4">
        {users.length > 0 ? (
          users.map((user) => (
            <div key={user.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="font-semibold text-lg">{user.name}</div>
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleOpenUserModal(user)}
                    className="btn-icon p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors duration-150"
                    title="Edit"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(user)}
                    className="btn-icon p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900 transition-colors duration-150"
                    title="Delete"
                  >
                    <Trash size={18} className="text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">{user.email}</div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Role: {user.role}</span>
                <button
                  onClick={() => handleStatusToggle(user.id)}
                  className={`px-3 py-1 text-xs leading-5 font-semibold rounded-full transition-colors duration-200
                    ${user.status === 'Active' ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100 hover:bg-green-200 dark:hover:bg-green-700' : ''}
                    ${user.status === 'Inactive' ? 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100 hover:bg-red-200 dark:hover:bg-red-700' : ''}
                    ${user.status === 'Pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100 hover:bg-yellow-200 dark:hover:bg-yellow-700' : ''}
                  `}
                  title="Click to change status"
                >
                  {user.status}
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            <p className="mb-4">No users invited yet.</p>
            <button
              onClick={() => handleOpenUserModal(null)}
              className="btn-primary flex items-center gap-2 mx-auto px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md transition-colors duration-200"
            >
              <UserPlus size={18} /> Invite User
            </button>
          </div>
        )}
      </div>

      {/* Unified User Form Modal */}
      <UserFormModal
        isOpen={showUserModal}
        onClose={handleCloseUserModal}
        userToEdit={userToEdit}
        onSave={handleSaveUser}
        showToast={showToast}
      />

      {/* Delete User Confirmation Modal */}
      {showDeleteConfirmModal && userToDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-red-600 dark:text-red-400">Confirm Deletion</h3>
            <p className="mb-6 text-gray-700 dark:text-gray-300">
              Are you sure you want to delete user <span className="font-bold">{userToDelete.name}</span>?
              This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm transition-colors duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

// Roles & Permissions Tab Component
const RolesTab = ({ showToast }) => {
  // Mock roles and permissions data
  const [roles, setRoles] = useState([
    { id: 'admin', name: 'Admin' },
    { id: 'projectLead', name: 'Project Lead' },
    { id: 'clerk', name: 'Clerk' },
  ]);

  const [permissions, setPermissions] = useState([
    { id: 'createProject', name: 'Create Project', admin: true, projectLead: true, clerk: false },
    { id: 'editProject', name: 'Edit Project', admin: true, projectLead: true, clerk: false },
    { id: 'deleteProject', name: 'Delete Project', admin: true, projectLead: false, clerk: false },
    { id: 'viewReports', name: 'View Reports', admin: true, projectLead: true, clerk: true },
    { id: 'manageUsers', name: 'Manage Users', admin: true, projectLead: false, clerk: false },
  ]);

  const [selectedRole, setSelectedRole] = useState(roles[0]?.id); // State for active role in list
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  
  // TODO: Use a useEffect hook to fetch roles and permissions from the backend on mount.
  // Example:
  // useEffect(() => {
  //   const fetchRolesAndPermissions = async () => {
  //     const [rolesRes, permsRes] = await Promise.all([
  //       fetch('/api/roles'),
  //       fetch('/api/permissions')
  //     ]);
  //     const rolesData = await rolesRes.json();
  //     const permsData = await permsRes.json();
  //     setRoles(rolesData);
  //     setPermissions(permsData);
  //   };
  //   fetchRolesAndPermissions();
  // }, []);

  const handlePermissionChange = (permissionId, roleId, isChecked) => {
    setPermissions(prevPermissions =>
      prevPermissions.map(perm =>
        perm.id === permissionId
          ? { ...perm, [roleId]: isChecked }
          : perm
      )
    );
    showToast('Permissions updated.', 'info');
    // TODO: Make a PUT or PATCH request to update the specific permission on the backend.
  };

  const handleAddRole = () => {
    if (!newRoleName.trim()) {
      showToast('Role name cannot be empty.', 'error');
      return;
    }
    const newId = newRoleName.toLowerCase().replace(/\s/g, '');
    if (roles.some(role => role.id === newId)) {
      showToast('Role with this name already exists.', 'error');
      return;
    }

    const newRole = { id: newId, name: newRoleName };
    setRoles([...roles, newRole]);

    // Add new role's permissions (defaulting to false for all)
    setPermissions(prevPermissions =>
      prevPermissions.map(perm => ({
        ...perm,
        [newId]: false,
      }))
    );
    // TODO: Make a POST request to the backend to create the new role and its default permissions.

    showToast(`Role '${newRoleName}' added.`, 'success');
    setNewRoleName('');
    setShowAddRoleModal(false);
    setSelectedRole(newId); // Select the newly added role
  };

  return (
    <section id="roles" role="tabpanel" aria-labelledby="roles-tab">
      <div className="grid grid-cols-12 gap-6">

        {/* Roles List */}
        <div className="col-span-12 md:col-span-4 lg:col-span-3 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium mb-3 flex items-center gap-2"><Shield size={20} /> Roles</h2>
          {roles.length > 0 ? (
            <ul className="space-y-1 mb-4">
              {roles.map((role) => (
                <li key={role.id}>
                  <button
                    onClick={() => setSelectedRole(role.id)}
                    className={`w-full text-left p-3 rounded-md transition-colors duration-150 ${
                      selectedRole === role.id
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {role.name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 mb-4">
              <p>Define your first role.</p>
            </div>
          )}
          <button
            onClick={() => setShowAddRoleModal(true)}
            className="btn-secondary w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
          >
            <Plus size={18} /> Add Role
          </button>
        </div>

        {/* Permissions Matrix */}
        <div className="col-span-12 md:col-span-8 lg:col-span-9 overflow-x-auto bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium mb-3 flex items-center gap-2"><Settings size={20} /> Permissions</h2>
          <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Permission</th>
                {roles.map((role) => (
                  <th key={role.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    {role.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {permissions.map((permission) => (
                <tr key={permission.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                  <td className="px-4 py-3 whitespace-nowrap">{permission.name}</td>
                  {roles.map((role) => (
                    <td key={`${permission.id}-${role.id}`} className="px-4 py-3 whitespace-nowrap text-center">
                      <input
                        type="checkbox"
                        className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:checked:bg-blue-600 dark:checked:border-transparent"
                        checked={permission[role.id]}
                        onChange={(e) => handlePermissionChange(permission.id, role.id, e.target.checked)}
                        aria-label={`${permission.name} for ${role.name}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>

      {/* Add Role Modal */}
      {showAddRoleModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add New Role</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="new-role-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Role Name</label>
                <input
                  type="text"
                  id="new-role-name"
                  className="mt-1 block w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white"
                  placeholder="e.g., Editor"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddRoleModal(false)}
                className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleAddRole}
                className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors duration-200"
              >
                Add Role
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

// System Settings Tab Component
const SettingsTab = ({ showToast }) => {
  // Existing states
  const [emailTemplate, setEmailTemplate] = useState(
    "Template for report reminders:\n\nHi [User Name],\n\nThis is a reminder that your [Report Type] report is due on [Due Date].\n\nBest regards,\nThe Admin Team"
  );
  const [notifyReportDue, setNotifyReportDue] = useState(false);
  const [notifyOnSubmission, setNotifyOnSubmission] = useState(true);
  const [weeklySummaryEmail, setWeeklySummaryEmail] = useState(false);

  // New states for Settings
  const [monthlyReportDueDate, setMonthlyReportDueDate] = useState('2025-07-15');
  const [fiscalYearStart, setFiscalYearStart] = useState('2025-01'); // YYYY-MM format for input type="month"
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [maxFileSize, setMaxFileSize] = useState('');
  const [allowedFileTypes, setAllowedFileTypes] = useState('');

  // TODO: Fetch settings from the backend when the component loads.
  // useEffect(() => {
  //   const fetchSettings = async () => {
  //     const response = await fetch('/api/settings');
  //     const data = await response.json();
  //     // Update state with fetched data
  //   };
  //   fetchSettings();
  // }, []);

  const handleTestConnection = () => {
    if (!smtpHost || !smtpPort || !smtpUsername || !smtpPassword) {
      showToast('Please fill in all email server details to test connection.', 'error');
      return;
    }
    // Simulate API call
    showToast('Testing connection...', 'info');
    setTimeout(() => {
      // TODO: Make a POST request to a backend endpoint to test the SMTP connection.
      // The backend should attempt to connect using the provided credentials.
      const success = Math.random() > 0.5; // Simulate success or failure
      if (success) {
        showToast('Connection successful!', 'success');
      } else {
        showToast('Connection failed. Check credentials and host.', 'error');
      }
    }, 1500);
  };

  const handleSaveSettings = () => {
    const settings = {
      monthlyReportDueDate,
      fiscalYearStart,
      smtpHost,
      smtpPort,
      smtpUsername,
      smtpPassword,
      maxFileSize,
      allowedFileTypes,
      emailTemplate,
      notifyReportDue,
      notifyOnSubmission,
      weeklySummaryEmail,
    };
    console.log("Saving settings:", settings);
    showToast('Settings saved successfully!', 'success');
    // TODO: Make a POST or PUT request to a backend API to save all settings.
    // Example:
    // await fetch('/api/settings', {
    //   method: 'PUT',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(settings)
    // });
  };

  return (
    <section id="settings" role="tabpanel" aria-labelledby="settings-tab" className="p-4 space-y-6">

      {/* Section: Reporting Period */}
      <div>
        <h2 className="text-lg font-medium mb-2 text-gray-800 dark:text-gray-200">Reporting Period</h2>
        <div className="space-y-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-md shadow-sm">
          <div>
            <label htmlFor="monthly-report-due-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Monthly Report Due Date</label>
            <input
              type="date"
              id="monthly-report-due-date"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              value={monthlyReportDueDate}
              onChange={(e) => setMonthlyReportDueDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="fiscal-year-start" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fiscal Year Start</label>
            <input
              type="month"
              id="fiscal-year-start"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              value={fiscalYearStart}
              onChange={(e) => setFiscalYearStart(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Section: Email Server */}
      <div>
        <h2 className="text-lg font-medium mb-2 text-gray-800 dark:text-gray-200">Email Server</h2>
        <div className="space-y-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-md shadow-sm">
          <div>
            <label htmlFor="smtp-host" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">SMTP Host</label>
            <input
              type="text"
              id="smtp-host"
              placeholder="e.g., smtp.example.com"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="smtp-port" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Port</label>
            <input
              type="number"
              id="smtp-port"
              placeholder="e.g., 587"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="smtp-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Username</label>
            <input
              type="text"
              id="smtp-username"
              placeholder="e.g., your_email@example.com"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              value={smtpUsername}
              onChange={(e) => setSmtpUsername(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="smtp-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input
              type="password"
              id="smtp-password"
              placeholder="Your email password"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
            />
          </div>
          <button
            onClick={handleTestConnection}
            className="btn-secondary px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center gap-2"
          >
            Test Connection
          </button>
        </div>
      </div>

      {/* Section: File Upload Limits */}
      <div>
        <h2 className="text-lg font-medium mb-2 text-gray-800 dark:text-gray-200">File Upload Settings</h2>
        <div className="space-y-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-md shadow-sm">
          <div>
            <label htmlFor="max-file-size" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max File Size (MB)</label>
            <input
              type="number"
              id="max-file-size"
              placeholder="e.g., 50"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              value={maxFileSize}
              onChange={(e) => setMaxFileSize(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="allowed-file-types" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Allowed File Types</label>
            <input
              type="text"
              id="allowed-file-types"
              placeholder="e.g., .pdf, .jpg, .png"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              value={allowedFileTypes}
              onChange={(e) => setAllowedFileTypes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Existing Notification Toggles */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium mb-3">Notifications</h2>
        <div className="space-y-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:checked:bg-blue-600 dark:checked:border-transparent"
              checked={notifyReportDue}
              onChange={(e) => setNotifyReportDue(e.target.checked)}
            />
            <span className="text-gray-700 dark:text-gray-300">Notify when report due</span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:checked:bg-blue-600 dark:checked:border-transparent"
              checked={notifyOnSubmission}
              onChange={(e) => setNotifyOnSubmission(e.target.checked)}
            />
            <span className="text-gray-700 dark:text-gray-300">Notify on submission</span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:checked:bg-blue-600 dark:checked:border-transparent"
              checked={weeklySummaryEmail}
              onChange={(e) => setWeeklySummaryEmail(e.target.checked)}
            />
            <span className="text-gray-700 dark:text-gray-300">Weekly summary email</span>
          </label>
        </div>
      </div>

      {/* Existing Email Templates */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium mb-3">Email Templates</h2>
        <textarea
          rows="6"
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white resize-y"
          placeholder="Template for report reminders…"
          value={emailTemplate}
          onChange={(e) => setEmailTemplate(e.target.value)}
        ></textarea>
      </div>

      {/* Save Settings Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveSettings}
          className="btn-primary px-6 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md transition-colors duration-200"
        >
          Save Settings
        </button>
      </div>

    </section>
  );
};

// New Audit Log Tab Component
const AuditLogTab = ({ showToast }) => {
  const mockAuditLogs = [
    { id: 1, timestamp: '2025-07-18 14:32', user: 'Alice Manager', entity: 'Project', action: 'Submitted', details: 'Project Z report submitted to HQ' },
    { id: 2, timestamp: '2025-07-18 10:00', user: 'John Clerk', entity: 'Report', action: 'Created', details: 'Monthly sales report draft' },
    { id: 3, timestamp: '2025-07-17 16:45', user: 'Jane Lead', entity: 'User', action: 'Updated', details: 'Changed John Clerk\'s role' },
    { id: 4, timestamp: '2025-07-17 09:15', user: 'Alice Manager', entity: 'Activity', action: 'Deleted', details: 'Removed old marketing campaign' },
    { id: 5, timestamp: '2025-07-16 11:30', user: 'System', entity: 'System', action: 'Backup', details: 'Daily database backup completed' },
    { id: 6, timestamp: '2025-07-16 08:00', user: 'Admin', entity: 'Settings', action: 'Updated', details: 'Changed monthly report due date' },
    { id: 7, timestamp: '2025-07-15 17:00', user: 'John Clerk', entity: 'Report', action: 'Updated', details: 'Updated Q2 financial report' },
    { id: 8, timestamp: '2025-07-15 11:00', user: 'Jane Lead', entity: 'Project', action: 'Created', details: 'New project: "Client Onboarding Initiative"' },
  ];

  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [filteredLogs, setFilteredLogs] = useState(mockAuditLogs);
  
  // TODO: Use a useEffect hook to fetch audit logs from the backend on component mount.
  // The fetch call could also include search and date filter parameters.
  // useEffect(() => {
  //   const fetchLogs = async () => {
  //     const response = await fetch(`/api/audit-logs?search=${searchQuery}&from=${fromDate}&to=${toDate}`);
  //     const data = await response.json();
  //     setFilteredLogs(data);
  //   };
  //   fetchLogs();
  // }, [searchQuery, fromDate, toDate]);

  useEffect(() => {
    // Filter logs based on search query and date range
    const applyFilters = () => {
      let tempLogs = mockAuditLogs;

      if (searchQuery) {
        const lowerCaseQuery = searchQuery.toLowerCase();
        tempLogs = tempLogs.filter(log =>
          log.user.toLowerCase().includes(lowerCaseQuery) ||
          log.entity.toLowerCase().includes(lowerCaseQuery) ||
          log.action.toLowerCase().includes(lowerCaseQuery) ||
          log.details.toLowerCase().includes(lowerCaseQuery)
        );
      }

      if (fromDate) {
        const fromDateTime = new Date(fromDate).setHours(0, 0, 0, 0);
        tempLogs = tempLogs.filter(log => new Date(log.timestamp).getTime() >= fromDateTime);
      }

      if (toDate) {
        const toDateTime = new Date(toDate).setHours(23, 59, 59, 999);
        tempLogs = tempLogs.filter(log => new Date(log.timestamp).getTime() <= toDateTime);
      }

      setFilteredLogs(tempLogs);
    };

    applyFilters();
  }, [searchQuery, fromDate, toDate]);

  const handleApplyFilters = () => {
    // In a real application, this would trigger the useEffect above to refetch data with new filters.
    // We already have a dependency array on the useEffect so simply a change in a filter state triggers a fetch
    showToast('Filters applied!', 'info');
  };

  const handleExportCSV = () => {
    // TODO: A more robust approach is to call a backend endpoint that generates and returns the CSV file.
    // Example:
    // window.open(`/api/audit-logs/export?search=${searchQuery}&from=${fromDate}&to=${toDate}`, '_blank');
    const headers = ["Timestamp", "User", "Entity", "Action", "Details"];
    const rows = filteredLogs.map(log => [
      log.timestamp,
      log.user,
      log.entity,
      log.action,
      log.details
    ]);

    let csvContent = headers.join(",") + "\n";
    rows.forEach(row => {
      csvContent += row.map(field => `"${field.replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "audit_log.csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Audit log exported to CSV!', 'success');
    } else {
      showToast('Your browser does not support downloading files directly.', 'error');
    }
  };

  return (
    <section id="auditLog" role="tabpanel" aria-labelledby="auditLog-tab" className="p-4 space-y-4">

      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Audit Log</h2>
        <button
          onClick={handleExportCSV}
          className="btn-secondary flex items-center gap-2 px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
        >
          <Download size={18} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-md shadow-sm">
        <input
          type="text"
          placeholder="Search logs…"
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white flex-grow md:flex-grow-0 md:w-1/3"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <label htmlFor="from-date" className="text-xl flex items-center">From Date</label>
        <input
          type="date"
          id="from-date"
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <label htmlFor="to-date" className="text-xl flex items-center">To Date</label>
        <input
          type="date"
          id="to-date"
          className="p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
        />
        <button
          onClick={handleApplyFilters}
          className="btn-primary px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-sm transition-colors duration-200"
        >
          Apply Filters
        </button>
      </div>

      {/* Log Table (Desktop View) */}
      <div className="hidden md:block overflow-x-auto rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        {filteredLogs.length > 0 ? (
          <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Timestamp</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Entity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{log.timestamp}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{log.user}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{log.entity}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{log.action}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            No audit log entries found for the current filters.
          </div>
        )}
      </div>

      {/* Log Card View (Mobile View) */}
      <div className="md:hidden space-y-4">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <div key={log.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{log.timestamp}</span>
              </div>
              <div className="text-sm">
                <div className="flex items-center space-x-1">
                  <span className="font-semibold">{log.user}</span>
                  <span className="text-gray-500 dark:text-gray-400">|</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">{log.action}</span>
                </div>
                <div className="text-gray-700 dark:text-gray-300 mt-1">{log.details}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="p-6 text-center text-gray-500 dark:text-gray-400">
            No audit log entries found for the current filters.
          </div>
        )}
      </div>
    </section>
  );
};

// Export the Admin component as default
export default Admin;
