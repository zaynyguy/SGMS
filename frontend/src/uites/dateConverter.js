// src/utils/dateConverter.js
import { toEthiopian } from 'ethiopian-date';

/**
 * Formats a Gregorian date string into either Ethiopian or standard locale format.
 * @param {string} gregorianDate - The date string from the server (e.g., "2023-10-27T10:00:00.000Z").
 * @param {string} lang - The current language code ('am', 'en', etc.).
 * @returns {string} - The formatted date string.
 */
export const formatDate = (gregorianDate, lang) => {
    if (!gregorianDate) return '';

    try {
        const dateObj = new Date(gregorianDate);
        if (lang === 'am') {
            // toEthiopian expects numbers for year, month, and day
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth() + 1; // getMonth() is 0-indexed
            const day = dateObj.getDate();
            return toEthiopian(year, month, day).toString();
        }
        
        // Default to a readable local date string for other languages
        return dateObj.toLocaleDateString(lang, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    } catch (error) {
        console.error("Error formatting date:", error);
        return "Invalid Date";
    }
};
