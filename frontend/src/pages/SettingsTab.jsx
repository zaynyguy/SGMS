import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const SettingsTab = ({ showToast }) => {
  const { t } = useTranslation();
  const [emailTemplate, setEmailTemplate] = useState(
    t('admin.settings.emailTemplate.default')
  );
  const [notifyReportDue, setNotifyReportDue] = useState(false);
  const [notifyOnSubmission, setNotifyOnSubmission] = useState(true);
  const [weeklySummaryEmail, setWeeklySummaryEmail] = useState(false);
  const [monthlyReportDueDate, setMonthlyReportDueDate] = useState('2025-07-15');
  const [fiscalYearStart, setFiscalYearStart] = useState('2025-01');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [maxFileSize, setMaxFileSize] = useState('');
  const [allowedFileTypes, setAllowedFileTypes] = useState('');

  const handleTestConnection = () => {
    if (!smtpHost || !smtpPort || !smtpUsername || !smtpPassword) {
      showToast(t('admin.settings.errors.missingEmailDetails'), 'error');
      return;
    }
    
    showToast(t('admin.settings.connectionTesting'), 'info');
    setTimeout(() => {
      const success = Math.random() > 0.5;
      if (success) {
        showToast(t('admin.settings.connectionSuccess'), 'success');
      } else {
        showToast(t('admin.settings.errors.connectionFailed'), 'error');
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
    showToast(t('admin.settings.saveSuccess'), 'success');
  };

  return (
    <section id="settings" role="tabpanel" aria-labelledby="settings-tab" className="p-4 space-y-6">
      {/* Reporting Period */}
      <div>
        <h2 className="text-lg font-medium mb-2 text-gray-800 dark:text-gray-200">
          {t('admin.settings.reportingPeriod.title')}
        </h2>
        <div className="space-y-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-md shadow-sm">
          <div>
            <label htmlFor="monthly-report-due-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.settings.reportingPeriod.monthlyDueDate')}
            </label>
            <input
              type="date"
              id="monthly-report-due-date"
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              value={monthlyReportDueDate}
              onChange={(e) => setMonthlyReportDueDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="fiscal-year-start" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.settings.reportingPeriod.fiscalYearStart')}
            </label>
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

      {/* Email Server */}
      <div>
        <h2 className="text-lg font-medium mb-2 text-gray-800 dark:text-gray-200">
          {t('admin.settings.emailServer.title')}
        </h2>
        <div className="space-y-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-md shadow-sm">
          <div>
            <label htmlFor="smtp-host" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.settings.emailServer.smtpHost')}
            </label>
            <input
              type="text"
              id="smtp-host"
              placeholder={t('admin.settings.emailServer.smtpHostPlaceholder')}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              value={smtpHost}
              onChange={(e) => setSmtpHost(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="smtp-port" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.settings.emailServer.port')}
            </label>
            <input
              type="number"
              id="smtp-port"
              placeholder={t('admin.settings.emailServer.portPlaceholder')}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              value={smtpPort}
              onChange={(e) => setSmtpPort(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="smtp-username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.settings.emailServer.username')}
            </label>
            <input
              type="text"
              id="smtp-username"
              placeholder={t('admin.settings.emailServer.usernamePlaceholder')}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              value={smtpUsername}
              onChange={(e) => setSmtpUsername(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="smtp-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.settings.emailServer.password')}
            </label>
            <input
              type="password"
              id="smtp-password"
              placeholder={t('admin.settings.emailServer.passwordPlaceholder')}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              value={smtpPassword}
              onChange={(e) => setSmtpPassword(e.target.value)}
            />
          </div>
          <button
            onClick={handleTestConnection}
            className="btn-secondary px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200 flex items-center gap-2"
          >
            {t('admin.settings.emailServer.testConnection')}
          </button>
        </div>
      </div>

      {/* File Upload Settings */}
      <div>
        <h2 className="text-lg font-medium mb-2 text-gray-800 dark:text-gray-200">
          {t('admin.settings.fileUpload.title')}
        </h2>
        <div className="space-y-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-md shadow-sm">
          <div>
            <label htmlFor="max-file-size" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.settings.fileUpload.maxFileSize')}
            </label>
            <input
              type="number"
              id="max-file-size"
              placeholder={t('admin.settings.fileUpload.maxFileSizePlaceholder')}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              value={maxFileSize}
              onChange={(e) => setMaxFileSize(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="allowed-file-types" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t('admin.settings.fileUpload.allowedFileTypes')}
            </label>
            <input
              type="text"
              id="allowed-file-types"
              placeholder={t('admin.settings.fileUpload.allowedFileTypesPlaceholder')}
              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-800 dark:text-white"
              value={allowedFileTypes}
              onChange={(e) => setAllowedFileTypes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium mb-3">
          {t('admin.settings.notifications.title')}
        </h2>
        <div className="space-y-3">
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:checked:bg-blue-600 dark:checked:border-transparent"
              checked={notifyReportDue}
              onChange={(e) => setNotifyReportDue(e.target.checked)}
            />
            <span className="text-gray-700 dark:text-gray-300">
              {t('admin.settings.notifications.reportDue')}
            </span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:checked:bg-blue-600 dark:checked:border-transparent"
              checked={notifyOnSubmission}
              onChange={(e) => setNotifyOnSubmission(e.target.checked)}
            />
            <span className="text-gray-700 dark:text-gray-300">
              {t('admin.settings.notifications.onSubmission')}
            </span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="checkbox"
              className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:checked:bg-blue-600 dark:checked:border-transparent"
              checked={weeklySummaryEmail}
              onChange={(e) => setWeeklySummaryEmail(e.target.checked)}
            />
            <span className="text-gray-700 dark:text-gray-300">
              {t('admin.settings.notifications.weeklySummary')}
            </span>
          </label>
        </div>
      </div>

      {/* Email Templates */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-medium mb-3">
          {t('admin.settings.emailTemplates.title')}
        </h2>
        <textarea
          rows="6"
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 bg-gray-50 dark:bg-gray-700 dark:text-white resize-y"
          placeholder={t('admin.settings.emailTemplates.placeholder')}
          value={emailTemplate}
          onChange={(e) => setEmailTemplate(e.target.value)}
        ></textarea>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSaveSettings}
          className="btn-primary px-6 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-md transition-colors duration-200"
        >
          {t('admin.settings.saveButton')}
        </button>
      </div>
    </section>
  );
};

export default SettingsTab;