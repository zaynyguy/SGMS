// src/pages/LoginPage.jsx
import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import companyLogo from '../assets/logo.png';
import { User, Lock, Eye, EyeOff } from 'lucide-react';

const LoginPage = () => {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const emailRef = useRef(null);

  useEffect(() => {
    // autofocus email for keyboard users
    if (emailRef.current) emailRef.current.focus();
  }, []);

  // Restart animation on mount for browsers that delay animations for offscreen content.
  useEffect(() => {
    // don't restart if user prefers reduced motion
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const els = document.querySelectorAll('.hero-logo');
    if (!els || els.length === 0) return;

    els.forEach((node) => {
      node.classList.remove('hero-logo');
      // force reflow to restart animation
      // eslint-disable-next-line no-unused-expressions
      node.offsetWidth;
      node.classList.add('hero-logo');
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(t('login.password_too_short'));
      return;
    }

    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      // err may be an Error or API response — fall back to default message
      setError((err && err.message) || t('login.error_default'));
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => setShowPassword((s) => !s);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 transition-colors duration-300 p-4 font-sans">
      {/* Global / always-present style block so animations exist on mobile too.
          Mobile uses a stronger/faster animation to make movement noticeable. */}
      <style>{`
        /* Desktop (subtle) */
        @keyframes heroFloat {
          0% { transform: translateY(0) scale(1); filter: drop-shadow(0 8px 24px rgba(0,0,0,0.45)); }
          50% { transform: translateY(-8px) scale(1.02); filter: drop-shadow(0 18px 42px rgba(99,102,241,0.22)); }
          100% { transform: translateY(0) scale(1); filter: drop-shadow(0 8px 24px rgba(0,0,0,0.45)); }
        }

        @keyframes glowPulse {
          0% { box-shadow: 0 0 20px rgba(59,130,246,0.10); }
          50% { box-shadow: 0 0 44px rgba(99,102,241,0.18); }
          100% { box-shadow: 0 0 20px rgba(59,130,246,0.10); }
        }

        /* Mobile: stronger, faster float so it's visible on small screens */
        @keyframes heroFloatMobile {
          0% { transform: translateY(0) scale(1); filter: drop-shadow(0 6px 16px rgba(0,0,0,0.35)); }
          25% { transform: translateY(-12px) scale(1.04); filter: drop-shadow(0 26px 56px rgba(79,142,215,0.26)); }
          50% { transform: translateY(0) scale(1.02); filter: drop-shadow(0 18px 42px rgba(79,142,215,0.20)); }
          75% { transform: translateY(-6px) scale(1.03); filter: drop-shadow(0 18px 42px rgba(79,142,215,0.22)); }
          100% { transform: translateY(0) scale(1); filter: drop-shadow(0 6px 16px rgba(0,0,0,0.35)); }
        }

        @keyframes glowPulseMobile {
          0% { box-shadow: 0 0 22px rgba(79,142,215,0.12); }
          50% { box-shadow: 0 0 72px rgba(79,142,215,0.28); }
          100% { box-shadow: 0 0 22px rgba(79,142,215,0.12); }
        }

        /* Base classes */
        .hero-logo {
          animation: heroFloat 4.5s ease-in-out infinite;
          will-change: transform, filter;
          transform-origin: center;
          display: block;
        }
        .hero-glow {
          animation: glowPulse 3.8s ease-in-out infinite;
          will-change: box-shadow;
        }

        /* Mobile overrides: apply stronger animation on small screens */
        @media (max-width: 767px) {
          .hero-logo {
            animation: heroFloatMobile 2.8s ease-in-out infinite;
          }
          .hero-glow {
            animation: glowPulseMobile 2.8s ease-in-out infinite;
          }
        }

        /* Respect reduced motion preference */
        @media (prefers-reduced-motion: reduce) {
          .hero-logo, .hero-glow { animation: none !important; transform: none !important; box-shadow: none !important; }
        }
      `}</style>

      <div className="w-full max-w-6xl grid md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl">
        {/* LEFT: Hero (logo + brand copy) */}
        <aside className="hidden md:flex flex-col items-center justify-center p-12 dark:bg-gradient-to-br dark:from-slate-900 dark:via-blue-800 dark:to-slate-900 bg-gradient-to-br from-slate-900 via-green-600 to-slate-900 text-white">
          <div className="max-w-md w-full text-center">
            <div className="flex flex-col items-center gap-6">
              <div className="p-6 rounded-full hero-glow bg-white/5" aria-hidden="true">
                <img
                  src={companyLogo}
                  alt={t('login.company_logo_alt', 'Company logo')}
                  className="hero-logo w-80 h-80 object-contain"
                />
              </div>

              <h1 className="text-3xl md:text-4xl font-semibold"> {t('login.title')} </h1>
              <p className="text-slate-200 max-w-xs mx-auto">
                {t('login.subtitle')}
              </p>
            </div>
          </div>
        </aside>

        {/* RIGHT: Form */}
        <main className="flex items-center justify-center p-8 bg-white dark:bg-slate-800">
          <div className="w-full max-w-md">
            {/* Mobile top logo + title (visible on small screens) */}
            <div className="md:hidden text-center mb-6">
              {/* Overflow visible so the glow and shadow are not clipped on mobile */}
              <div className="dark:bg-gradient-to-br dark:from-slate-900 dark:via-blue-800 dark:to-slate-900 bg-gradient-to-br from-slate-900 via-green-600 to-slate-900 w-full p-0 rounded-bl-full rounded-br-full overflow-visible">
                <div className="p-4 flex justify-center">
                  <img
                    src={companyLogo}
                    alt={t('login.company_logo_alt', 'Company logo')}
                    className="mx-auto hero-logo w-40 h-40 object-contain mb-4 rounded-full hero-glow bg-white/5"
                  />
                </div>
              </div>

              <h1 className="text-2xl text-gray-800 dark:text-gray-300 font-semibold">{t('login.title')}</h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">{t('login.subtitle')}</p>
            </div>

            <div className="bg-gray-200 dark:bg-slate-700 border-rose-400 rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl flex justify-center font-medium mb-6 text-slate-900 dark:text-white">
                {t('login.form_title', 'Log in to your account')}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div>
                  <label htmlFor="name" className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <User size={16} /> <span>{t('login.username_label')}</span>
                  </label>
                  <input
                    ref={emailRef}
                    id="name"
                    name="name"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    placeholder={t('login.username_placeholder')}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="mt-2 block w-full rounded-lg border-2 border-slate-50 dark:border-slate-600 px-4 py-3 bg-transparent focus:outline-none focus:ring-2 focus:ring-green-400 dark:focus:ring-blue-400 dark:text-white"
                    aria-label={t('login.username_label')}
                  />
                </div>

                <div className="relative">
                  <label htmlFor="password" className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <Lock size={16} /> <span>{t('login.password_label')}</span>
                  </label>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder={t('login.password_placeholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="mt-2 block w-full rounded-lg border-2 border-slate-50 dark:border-slate-600 px-4 py-3 bg-transparent focus:outline-none focus:ring-2 focus:ring-green-400 dark:focus:ring-blue-400 dark:text-white"
                    aria-label={t('login.password_label')}
                  />

                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    aria-label={showPassword ? t('login.hide_password') : t('login.show_password')}
                    className="absolute right-3 top-8 rounded-full p-1 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {error && (
                  <div role="alert" aria-live="polite">
                    <p className="text-sm text-red-500">{error}</p>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 rounded-lg bg-green-600 dark:bg-blue-700 hover:bg-green-700 dark:hover:bg-blue-800 text-white font-semibold shadow focus:outline-none focus:ring-2 focus:ring-green-400 dark:focus:ring-indigo-400 disabled:opacity-60"
                  >
                    {loading ? t('login.logging_in') : t('login.button_signin')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default LoginPage;
