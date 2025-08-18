// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import companyLogo from '../assets/logo.png';
import { ChevronDown, User, UserLock } from 'lucide-react';

const LoginPage = () => {
    const { t, i18n } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        // Add password length validation
        if (password.length < 8) {
            setError(t('login.password_too_short'));
            return;
        }

        setLoading(true);
        try {
            await login(username, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err.message || t('login.error_default'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen w-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-sans p-4">
            <div className="w-full max-w-4xl grid md:grid-cols-2 rounded-xl md:rounded-2xl overflow-hidden shadow-2xl relative">
                <div className="absolute inset-0 bg-white/10 backdrop-blur-xl z-0"></div>
                <div className="w-full p-4 sm:p-8 md:p-12 flex flex-col justify-center text-slate-800 dark:text-white relative z-10">
                    <div className='flex justify-between items-center'>
                        <div className='flex-col'>
                            <h1 className="text-4xl font-bold mb-2">{t('login.title')}</h1>
                            <p className="text-slate-800 dark:text-white/80 mb-2">{t('login.subtitle')}</p>
                            <p className="text-slate-800 dark:text-white/80 mb-8">{t('login.prompt')}</p>
                        </div>
                        <div className='md:hidden justify-center items-center'>
                            <img src={companyLogo} alt="Logo of Urban Development and Management Region" className='size-40 h-fit' />         
                        </div>
                    </div>

                    <form className="space-y-3" onSubmit={handleSubmit}>
                        <div>
                            <label className="flex gap-1 items-end text-sm text-slate-800 dark:text-white/80">
                                <User/> {t('login.username_label')}
                            </label>
                            <input
                                type="text"
                                placeholder={t('login.username_placeholder')}
                                className="w-full mt-2 px-4 py-3 bg-black/30 dark:bg-slate-200 rounded-lg border border-white/20 focus:outline-none transition-all duration-300 text-white dark:text-slate-800 placeholder:text-slate-200 placeholder:dark:text-slate-800"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <label className="flex gap-1 items-end text-sm text-slate-800 dark:text-white/80">
                                <UserLock/> {t('login.password_label')}
                            </label>
                            <input
                                type="password"
                                placeholder={t('login.password_placeholder')}
                                className="w-full mt-2 px-4 py-3 bg-black/30 dark:bg-slate-200 rounded-lg border border-white/20 focus:outline-none transition-all duration-300 text-white dark:text-slate-800 placeholder:text-slate-200 placeholder:dark:text-slate-800"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="keep-logged-in"
                                    className="h-4 w-4 rounded bg-sltext-slate-800 border-white/30 focus:ring-pink-500"
                                    checked={remember}
                                    onChange={() => setRemember(!remember)}
                                />
                                <label htmlFor="keep-logged-in" className="ml-2 text-slate-800 dark:text-white/80">
                                    {t('login.remember_label')}
                                </label>
                            </div>
                        </div>
                        {error && <p className="text-red-400">{error}</p>}
                        <div>
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full py-3 bg-green-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-green-600 rounded-lg font-bold text-white shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-70"
                            >
                                {loading ? t('login.logging_in') : t('login.button_signin')}
                            </button>
                        </div>
                    </form>
                </div>

                <div className="hidden md:flex flex-col justify-between relative">
                    <div className="relative bg-black/30 dark:bg-slate-200 rounded-l-3xl h-full flex flex-col justify-center">
                        <img src={companyLogo} alt="Company Logo" className="mx-auto" />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;