// src/components/common/LanguageSwitcher.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = () => {
    const { i18n } = useTranslation();

    const handleLanguageChange = (e) => {
        const newLang = e.target.value;
        i18n.changeLanguage(newLang);
    };

    return (
        <div className="p-2">
            <label htmlFor="language-select" className="sr-only">Language</label>
            <select
                id="language-select"
                value={i18n.language}
                onChange={handleLanguageChange}
                className="w-full p-2 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                <option value="en">English</option>
                <option value="am">አማርኛ</option>
                <option value="om">Oromoo</option>
            </select>
        </div>
    );
};

export default LanguageSwitcher;
