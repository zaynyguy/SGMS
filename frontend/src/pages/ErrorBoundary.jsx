import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ErrorBoundary = ({ children }) => {
  const [errorState, setErrorState] = useState({
    hasError: false,
    error: null,
    errorInfo: null
  });
  const { t } = useTranslation();

  const componentDidCatch = (error, errorInfo) => {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    setErrorState({
      hasError: true,
      error: error,
      errorInfo: errorInfo
    });
  };

  if (errorState.hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-100 text-red-800 p-4">
        <div className="text-center">
          <AlertTriangle size={48} className="mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-2xl font-bold mb-2">{t('errorBoundary.title')}</h1>
          <p className="mb-4">{t('errorBoundary.message')}</p>
          {errorState.error && (
            <details className="mt-4 p-2 bg-red-50 rounded text-sm text-left">
              <summary>{t('errorBoundary.detailsTitle')}</summary>
              <div className="mt-2">
                <p className="font-semibold">{t('errorBoundary.technicalDetails')}</p>
                <pre className="whitespace-pre-wrap break-all">
                  {errorState.error.toString()}
                </pre>
                {errorState.errorInfo && (
                  <>
                    <p className="font-semibold mt-2">{t('errorBoundary.componentStack')}</p>
                    <pre className="whitespace-pre-wrap break-all">
                      {errorState.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            {t('errorBoundary.refreshButton')}
          </button>
        </div>
      </div>
    );
  }

  return children;
};

export default ErrorBoundary;