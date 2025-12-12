import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from "lucide-react";

const AccessDeniedPage = () => {
    const { t } = useTranslation();
    const [mounted, setMounted] = useState(false);
    
    // Dark mode state
    const [darkMode, setDarkMode] = useState(false);
    
    // Toggle dark mode
    const toggleDarkMode = () => {
        setDarkMode(!darkMode);
    };

    // Material Design 3 color system - light theme
    const lightColors = {
        primary: "#00684A", // Deep green (MD3 primary)
        onPrimary: "#FFFFFF",
        primaryContainer: "#94F4C6", // Light green container
        onPrimaryContainer: "#002015", // Dark green text on container
        error: "#BA1A1A",
        onError: "#FFFFFF",
        errorContainer: "#FFDAD6",
        onErrorContainer: "#410002",
        background: "#FCFDF7",
        onBackground: "#1A1C19",
        surface: "#FCFDF7",
        onSurface: "#1A1C19",
        surfaceVariant: "#DDE4D9",
        onSurfaceVariant: "#414941",
        outline: "#717970",
        outlineVariant: "#C1C9C0",
        shadow: "#000000",
        scrim: "#000000",
        inverseSurface: "#2E312E",
        inverseOnSurface: "#F0F2EC",
        surfaceContainerLowest: "#FFFFFF",
        surfaceContainerLow: "#F8F9F4",
        surfaceContainer: "#F2F4EF",
        surfaceContainerHigh: "#ECF0E8",
        surfaceContainerHighest: "#E6EAE2",
    };

    // Material Design 3 color system - dark theme
    const darkColors = {
        primary: "#4ADE80", // Lighter green for dark mode
        onPrimary: "#002115",
        primaryContainer: "#003925",
        onPrimaryContainer: "#BBF7D0",
        error: "#FFB4AB",
        onError: "#690005",
        errorContainer: "#93000A",
        onErrorContainer: "#FFDAD6",
        background: "#1A1C19",
        onBackground: "#E1E3DD",
        surface: "#1A1C19",
        onSurface: "#E1E3DD",
        surfaceVariant: "#444C45",
        onSurfaceVariant: "#C2C9C2",
        outline: "#8C948D",
        outlineVariant: "#444C45",
        shadow: "#000000",
        scrim: "#000000",
        inverseSurface: "#E1E3DD",
        inverseOnSurface: "#1A1C19",
        surfaceContainerLowest: "#222421",
        surfaceContainerLow: "#2D2F2C",
        surfaceContainer: "#313330",
        surfaceContainerHigh: "#3B3D3A",
        surfaceContainerHighest: "#454744",
    };

    // Select colors based on dark mode
    const m3Colors = darkMode ? darkColors : lightColors;

    useEffect(() => {
        requestAnimationFrame(() => setMounted(true));
        return () => setMounted(false);
    }, []);

    return (
        <div 
            className={`min-h-screen flex flex-col items-center justify-center p-4 bg-gray-200 dark:bg-gray-900 transition-colors duration-300 ${
                mounted ? 'opacity-100 animate-fade-in' : 'opacity-0'
            }`}
            style={{
                "--primary": m3Colors.primary,
                "--on-primary": m3Colors.onPrimary,
                "--primary-container": m3Colors.primaryContainer,
                "--on-primary-container": m3Colors.onPrimaryContainer,
                "--error": m3Colors.error,
                "--on-error": m3Colors.onError,
                "--error-container": m3Colors.errorContainer,
                "--on-error-container": m3Colors.onErrorContainer,
                "--background": m3Colors.background,
                "--on-background": m3Colors.onBackground,
                "--surface": m3Colors.surface,
                "--on-surface": m3Colors.onSurface,
                "--surface-variant": m3Colors.surfaceVariant,
                "--on-surface-variant": m3Colors.onSurfaceVariant,
                "--outline": m3Colors.outline,
                "--outline-variant": m3Colors.outlineVariant,
                "--shadow": m3Colors.shadow,
                "--scrim": m3Colors.scrim,
                "--inverse-surface": m3Colors.inverseSurface,
                "--inverse-on-surface": m3Colors.inverseOnSurface,
                "--surface-container-lowest": m3Colors.surfaceContainerLowest,
                "--surface-container-low": m3Colors.surfaceContainerLow,
                "--surface-container": m3Colors.surfaceContainer,
                "--surface-container-high": m3Colors.surfaceContainerHigh,
                "--surface-container-highest": m3Colors.surfaceContainerHighest,
            }}
        >
            <style>{`
                @keyframes fade-in {
                    from {
                        opacity: 0;
                        transform: translateY(8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fade-in {
                    animation: fade-in 300ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .surface-elevation-1 { 
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04); 
                    border: none;
                }
                .surface-elevation-2 { 
                    box-shadow: 0 2px 6px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06); 
                    border: none;
                }
                .surface-elevation-3 { 
                    box-shadow: 0 4px 12px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.08); 
                    border: none;
                }
                .md3-card {
                    border-radius: 20px;
                    overflow: hidden;
                }
                .md3-button {
                    border-radius: 20px;
                    padding: 8px 16px;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }
            `}</style>

            <div className="max-w-md w-full bg-[var(--surface-container-low)] dark:bg-gray-800 rounded-2xl shadow-xl surface-elevation-3 p-6 md:p-8 text-center animate-fade-in border border-[var(--outline-variant)] dark:border-gray-700">
                <div className="mb-6">
                    <div className="w-16 h-16 mx-auto rounded-full bg-[var(--error-container)] dark:bg-red-900 flex items-center justify-center mb-4">
                        <svg 
                            className="w-8 h-8 text-[var(--on-error-container)] dark:text-red-200" 
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                        >
                            <path 
                                strokeLinecap="round" 
                                strokeLinejoin="round" 
                                strokeWidth="2" 
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                        </svg>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold text-[var(--on-surface)] dark:text-white mt-2">
                        {t('accessDenied.title')}
                    </h1>
                </div>

                <div className="mb-6 animate-fade-in" style={{ animationDelay: "100ms" }}>
                    <h2 className="text-2xl md:text-3xl font-semibold text-[var(--on-surface)] dark:text-white mb-2">
                        {t('accessDenied.heading')}
                    </h2>
                    <p className="text-[var(--on-surface-variant)] dark:text-gray-400 text-base md:text-lg leading-relaxed">
                        {t('accessDenied.message')}
                    </p>
                </div>

                <div className="mt-6 animate-fade-in" style={{ animationDelay: "200ms" }}>
                    <Link 
                        to="/" 
                        className="inline-flex items-center justify-center px-5 py-3 bg-[var(--primary)] dark:bg-green-700 hover:bg-[color-mix(in_srgb,var(--primary),white_10%)] dark:hover:bg-green-600 text-[var(--on-primary)] dark:text-white rounded-xl font-medium transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                    >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        {t('accessDenied.button')}
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default AccessDeniedPage;