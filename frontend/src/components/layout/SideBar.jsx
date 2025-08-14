import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { Home, Settings, LogOut, Menu, X, UserStar } from 'lucide-react';
import companyLogo from '../../assets/logo.png';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleColorSchemeChange = (e) => {
      document.documentElement.classList.toggle('dark', e.matches);
    };

    handleColorSchemeChange(colorSchemeQuery);
    colorSchemeQuery.addEventListener('change', handleColorSchemeChange);

    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setIsMobileOpen(false);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      colorSchemeQuery.removeEventListener('change', handleColorSchemeChange);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const hasPermission = (permission) => user?.permissions?.includes(permission);
  const toggleMobileMenu = () => setIsMobileOpen((prev) => !prev);

  const mainMenuItems = [
    { to: '/dashboard', icon: <Home size={20} />, label: t('sidebar.menu.dashboard') },
    { to: '/settings', icon: <Settings size={20} />, label: t('sidebar.menu.settings') },
    hasPermission('manage_roles') && {
      to: '/admin',
      icon: <UserStar size={20} />,
      label: t('sidebar.menu.admin'),
    },
  ].filter(Boolean);

  const MobileMenuButton = () => (
    <button
      onClick={toggleMobileMenu}
      className="md:hidden fixed top-3 right-3 z-50 p-2 rounded-md bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800"
      aria-label={isMobileOpen ? t('sidebar.closeMenu') : t('sidebar.openMenu')}
    >
      {isMobileOpen ? <X size={20} /> : <Menu size={20} />}
    </button>
  );

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center p-4 h-16 border-b border-gray-300 dark:border-gray-700">
        <img src={companyLogo} alt={t('sidebar.logoAlt')} className="h-11 w-11" />
        <span
          className={`ml-3 text-lg font-bold text-gray-900 dark:text-white truncate transition-all duration-300 ${
            isHovered ? 'opacity-100 w-auto' : 'opacity-0 w-0'
          }`}
        >
          {t('sidebar.appName')}
        </span>
      </div>

      {/* Menu */}
      <nav className="flex-1 space-y-2 p-2">
        {mainMenuItems.map((item, idx) => (
          <NavLink
            key={`main-${idx}`}
            to={item.to}
            onClick={() => isMobile && setIsMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center p-3 rounded-md transition-colors duration-200 ${
                isActive
                  ? 'bg-gray-300 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`
            }
            aria-label={item.label}
          >
            {item.icon}
            <span
              className={`ml-4 overflow-hidden whitespace-nowrap transition-all duration-300 ${
                isHovered ? 'w-full opacity-100' : 'w-0 opacity-0'
              }`}
            >
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-gray-300 dark:border-gray-700">
        <button
          onClick={logout}
          className="flex items-center w-full p-3 rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors"
          aria-label={t('sidebar.logout')}
        >
          <LogOut size={20} />
          <span
            className={`ml-4 overflow-hidden whitespace-nowrap transition-all duration-300 ${
              isHovered ? 'w-full opacity-100' : 'w-0 opacity-0'
            }`}
          >
            {t('sidebar.logout')}
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <MobileMenuButton />

      {/* Desktop Sidebar */}
      <div
        className={`hidden md:block fixed h-full bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${
          isHovered ? 'w-64' : 'w-20'
        }`}
        onMouseEnter={() => !isMobile && setIsHovered(true)}
        onMouseLeave={() => !isMobile && setIsHovered(false)}
        aria-label={t('sidebar.navigation')}
      >
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={toggleMobileMenu}
            aria-hidden="true"
          />
          <div className="relative w-64 h-full bg-white dark:bg-gray-800">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div
        className={`transition-all duration-300 ${
          isMobile ? 'ml-0' : isHovered ? 'ml-64' : 'ml-20'
        }`}
      >
        {/* Routed content renders here */}
      </div>
    </>
  );
};

export default Sidebar;