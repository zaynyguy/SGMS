import React from 'react';
import { useTranslation } from 'react-i18next';

const LanguageSwitcher = ({ value, onChange }) => {
  const { i18n } = useTranslation();

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;

    // Update parent state
    if (onChange) onChange(newLang);

    // Change i18n immediately
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="p-2">
      <label htmlFor="language-select" className="sr-only">Language</label>
      <select
        id="language-select"
        value={value || i18n.language}
        onChange={handleLanguageChange}
        className="w-full p-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <option value="en">English</option>
        <option value="am">አማርኛ</option>
        <option value="or">Oromoo</option>
        <option value="hr">Harari</option>
      </select>
    </div>
  );
};

export default LanguageSwitcher;
