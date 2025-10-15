import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, Settings, Shield, ChevronDown, CheckCircle, XCircle, Info } from 'lucide-react';
import ErrorBoundary from './ErrorBoundary';
import UsersPage from './UsersManagementPage';
import RolesManagementPage from './RolesManagementPage';
import SettingsPage from './SystemSettingsPage';
import AuditLogTab from './AuditLogTab';

const Admin = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const { t } = useTranslation();

  const tabs = [
    { id: 'users', name: t('admin.tabs.users'), icon: <UserPlus size={16} /> },
    { id: 'roles', name: t('admin.tabs.roles'), icon: <Shield size={16} /> },
    { id: 'settings', name: t('admin.tabs.settings'), icon: <Settings size={16} /> },
    { id: 'auditLog', name: t('admin.tabs.auditLog'), icon: <Info size={16} /> },
  ];

  const handleTabChange = (tabId, event) => {
    if (event) event.preventDefault();
    setActiveTab(tabId);
    setIsMobileMenuOpen(false);
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-inter">
      <header className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm z-10 p-4 flex items-center justify-between">
        <div className="text-2xl font-bold">{t('admin.title')}</div>
      </header>

      <div className="flex">
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          <div className="p-4 space-y-4 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h1 className="text-2xl font-semibold">{t('admin.header')}</h1>
              
              {/* Mobile Tab Dropdown */}
              <div className="relative md:hidden w-full">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="w-full flex items-center justify-between px-4 py-2 font-medium bg-gray-100 dark:bg-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  aria-label={t('admin.mobileMenu.toggle')}
                >
                  {tabs.find(tab => tab.id === activeTab)?.name}
                  <ChevronDown size={16} />
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
                          aria-label={t('admin.tabs.switchTo', { tab: tab.name })}
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
                      aria-label={t('admin.tabs.switchTo', { tab: tab.name })}
                    >
                      {tab.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <ErrorBoundary>
              {activeTab === 'users' && <UsersPage showToast={showToast} />}
              {activeTab === 'roles' && <RolesManagementPage showToast={showToast} />}
              {activeTab === 'settings' && <SettingsPage showToast={showToast} />}
              {activeTab === 'auditLog' && <AuditLogTab showToast={showToast} />}
            </ErrorBoundary>
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
          aria-live="assertive"
        >
          {toast.type === 'success' && <CheckCircle size={20} aria-hidden="true" />}
          {toast.type === 'error' && <XCircle size={20} aria-hidden="true" />}
          {toast.type === 'info' && <Info size={20} aria-hidden="true" />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default Admin;