import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const AccessDeniedPage = () => {
    const { t } = useTranslation();
    
    return (
        <div className="flex flex-col items-center justify-center h-screen bg-gray-100 text-center">
            <h1 className="text-6xl font-bold text-red-600">{t('accessDenied.title')}</h1>
            <h2 className="text-3xl font-semibold text-gray-800 mt-4">{t('accessDenied.heading')}</h2>
            <p className="text-gray-600 mt-2">
                {t('accessDenied.message')}
            </p>
            <Link 
              to="/" 
              className="mt-6 px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
                {t('accessDenied.button')}
            </Link>
        </div>
    );
};

export default AccessDeniedPage;