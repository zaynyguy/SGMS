import { Home, Settings, LogOut, Menu, X, User, Users, Goal, UserPen, Settings2Icon, ClipboardCheck, ListTodo, Activity, Accessibility } from 'lucide-react';

export const MenuItems = [
    { to: '/dashboard', icon: <Home size={24} />, label: t('sidebar.menu.dashboard') },
    { to: '/settings', icon: <Settings size={24} />, label: t('sidebar.menu.settings') },
    hasPermission('manage_roles') && { to: '/groupsmanagement', icon: <Users size={24} />, label: 'Groups Management' },
    // hasPermission('manage_roles') && { to: '/goalsmanagement', icon: <Goal size={24} />, label: 'Goals Management' },
    hasPermission('manage_roles') && { to: '/usersmanagement', icon: <User size={24} />, label: 'Users Management', requr },
    hasPermission('manage_roles') && { to: '/rolesmanagement', icon: <UserPen size={24} />, label: 'Roles Management' },
    hasPermission('manage_roles') && { to: '/systemsettings', icon: <Settings2Icon size={24} />, label: 'System Settings' },
    hasPermission('manage_roles') && { to: '/auditLog', icon: <ClipboardCheck size={24} />, label: 'Audit' },
    // hasPermission('manage_roles') && { to: '/tasksmanagement', icon: <ListTodo size={24} />, label: 'Tasks Management' },
    // hasPermission('manage_roles') && { to: '/activity', icon: <Activity size={24} />, label: 'Activity' },
    hasPermission('manage_roles') && { to: '/accessmanagement', icon: <Accessibility size={24} />, label: 'Access Management' },
    hasPermission('manage_roles') && { to: '/report', icon: <Accessibility size={24} />, label: 'Report' },
    hasPermission('manage_roles') && { to: '/objective', icon: <Accessibility size={24} />, label: 'Objective' },
  ].filter(Boolean);
  
  // src/config/menu.js
// import { Home, Settings, Users, FileText } from 'lucide-react';

// export const MENU = [
//   { to: '/dashboard', label: 'Dashboard', icon: Home, required: null },
//   { to: '/settings', label: 'Settings', icon: Settings, required: null },
//   { to: '/users', label: 'Users', icon: Users, required: 'manage_users' },
//   { to: '/reports', label: 'Reports', icon: FileText, required: 'view_reports' },
// ];