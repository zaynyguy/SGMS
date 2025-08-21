import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Home, Settings, LogOut, Menu, X, User, Users, Goal, UserPen, Settings2Icon, ClipboardCheck, ListTodo, Activity, FileChartColumnIncreasing, Paperclip } from 'lucide-react';
import companyLogo from '../../assets/logo.png';

const Sidebar = ({ children }) => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setIsExpanded(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const hasPermission = (permission) => user?.permissions?.includes(permission);

  const mainMenuItems = [
    { to: '/dashboard', icon: <Home size={24} />, label: t('sidebar.menu.dashboard') },
    { to: '/settings', icon: <Settings size={24} />, label: t('sidebar.menu.settings') },
    hasPermission('manage_roles') && { to: '/groupsmanagement', icon: <Users size={24} />, label: 'Groups Management' },
    hasPermission('manage_roles') && { to: '/goalsmanagement', icon: <Goal size={24} />, label: 'Goals Management' },
    hasPermission('manage_roles') && { to: '/usersmanagement', icon: <User size={24} />, label: 'Users Management' },
    hasPermission('manage_roles') && { to: '/rolesmanagement', icon: <UserPen size={24} />, label: 'Roles Management' },
    hasPermission('manage_roles') && { to: '/systemsettings', icon: <Settings2Icon size={24} />, label: 'System Settings' },
    hasPermission('manage_roles') && { to: '/auditLog', icon: <ClipboardCheck size={24} />, label: 'Audit' },
    hasPermission('manage_roles') && { to: '/tasksmanagement', icon: <ListTodo size={24} />, label: 'Tasks Management' },
    hasPermission('manage_roles') && { to: '/activity', icon: <Activity size={24} />, label: 'Activity' },
    hasPermission('manage_roles') && { to: '/attachment', icon: <Paperclip size={24} />, label: 'Attachment' },
    hasPermission('manage_roles') && { to: '/report', icon: <FileChartColumnIncreasing size={24} />, label: 'Report' },
  ].filter(Boolean);

  const toggleSidebar = () => setIsExpanded(!isExpanded);
  const handleMouseEnter = () => !isMobile && setIsHovered(true);
  const handleMouseLeave = () => !isMobile && setIsHovered(false);

  const showExpanded = isMobile ? isExpanded : isHovered;
  const sidebarWidth = showExpanded ? 'w-64' : 'w-20';
  const contentMargin = !isMobile ? (showExpanded ? 'ml-64' : 'ml-20') : 'ml-0'; // Only push on desktop

  const formatName = (name) => {
    if (!name) return '';
    return name.length > 15 && !showExpanded ? `${name.substring(0, 12)}...` : name;
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      {isMobile && (
        <button
          onClick={toggleSidebar}
          className="md:hidden top-4 right-3 fixed z-50 p-2 rounded-md bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800 shadow-md"
          aria-label={isExpanded ? t('sidebar.closeMenu') : t('sidebar.openMenu')}
        >
          {isExpanded ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}

      {/* Sidebar */}
      <div
        className={`fixed h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 z-40 ${sidebarWidth}
          ${isMobile && !isExpanded ? 'hidden' : 'block'}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div className="flex items-center justify-center p-4 h-16 border-b border-gray-300 dark:border-gray-700">
            <div className="flex items-center min-w-0">
              <img src={companyLogo} alt={t('sidebar.logoAlt')} className="h-10 w-10 min-w-[2.5rem]" />
              {showExpanded && (
                <span className="ml-3 text-lg font-bold text-gray-900 dark:text-white truncate">
                  {t('sidebar.appName')}
                </span>
              )}
            </div>
          </div>

          {/* Menu Items */}
          <nav className="flex-1 space-y-1 p-2 overflow-y-auto">
            {mainMenuItems.map((item, idx) => (
              <NavLink
                key={`main-${idx}`}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center p-3 rounded-md transition-colors duration-200 ${
                    isActive
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  } ${showExpanded ? 'justify-start' : 'justify-center'}`
                }
                aria-label={item.label}
              >
                <div className="flex-shrink-0 flex items-center justify-center w-6">{item.icon}</div>
                {showExpanded && <span className="ml-3 truncate">{item.label}</span>}
              </NavLink>
            ))}
          </nav>

          {/* User Info */}
          <div className="mt-auto p-3 border-t border-gray-200 dark:border-gray-700">
            <div className={`flex items-center ${showExpanded ? 'justify-start' : 'justify-center'}`}>
              {showExpanded ? (
                <div className="flex items-center min-w-0">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-800 dark:bg-gray-200 text-gray-200 dark:text-gray-800 flex items-center justify-center mr-3">
                    <span className="font-bold">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 dark:text-white truncate">{formatName(user?.name)}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.role || ''}</div>
                  </div>
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-800 dark:bg-gray-200 text-gray-200 dark:text-gray-800 flex items-center justify-center">
                  <span className="font-bold">{user?.name?.charAt(0)?.toUpperCase() || 'U'}</span>
                </div>
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={logout}
              className={`flex items-center w-full mt-3 p-2 rounded-md transition-colors duration-200
                ${showExpanded ? 'justify-start' : 'justify-center'}
                bg-red-500 hover:bg-red-600 text-white`}
              aria-label={t('sidebar.logout')}
            >
              <LogOut size={24} />
              {showExpanded && <span className="ml-3 truncate">{t('sidebar.logout')}</span>}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${contentMargin}`}>
        {children}
      </div>
    </>
  );
};

export default Sidebar;
