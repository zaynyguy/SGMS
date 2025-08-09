import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';        // <-- import hook
import companyLogo from '../assets/logo.png';
import { ChevronDown, User, UserLock} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { t, i18n } = useTranslation();             // get t() and i18n
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState(null);
  const { saveAuth } = useAuth();
  const navigate = useNavigate();

const handleSubmit = async (e) => {
  e.preventDefault();
  setError(null);


  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username , password }), // ✅ key fixed
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || t('login.error_default'));

    // ✅ Save JWT and user in context
    saveAuth({ token: data.token, user: data.user });

    // ✅ Remember option handling
    if (remember) {
      localStorage.setItem('remember', 'true');
    } else {
      localStorage.removeItem('remember');
    }

    navigate('/admin');
  } 
  catch (err) {
    setError(err.message);
  }
};

  return (
    <div className="min-h-screen w-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-sans p-4">
      <div className="w-full max-w-6xl grid md:grid-cols-2 rounded-3xl overflow-hidden shadow-2xl relative">
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

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="flex gap-1 items-end text-sm text-slate-800 dark:text-white/80">
               <User/> {t('login.username_label')}
              </label>
              <input
                type="text"
                placeholder={t('login.username_placeholder')}
                className="w-full mt-2 px-4 py-3 bg-black/30 dark:bg-slate-200 rounded-lg border border-white/20 focus:outline-none transition-all duration-300 placeholder:text-slate-200 placeholder:dark:text-slate-800"
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
                className="w-full mt-2 px-4 py-3 bg-black/30 dark:bg-slate-200 rounded-lg border border-white/20 focus:outline-none transition-all duration-300 placeholder:text-slate-200 placeholder:dark:text-slate-800"
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
                className="w-full py-3 bg-green-600 hover:bg-blue-500 dark:bg-blue-500 dark:hover:bg-green-600 rounded-lg font-bold text-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {t('login.button_signin')}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <label htmlFor="language" className="block text-sm font-medium text-slate-800 dark:text-white/80 mb-1">
              {t('login.language_label')}
            </label>
            <div className="relative">
              <select
                id="language"
                name="language"
                autoComplete="language-name"
                className="w-full appearance-none rounded-md bg-black/30 dark:bg-slate-200 py-1.5 pl-3 pr-8 text-slate-200 dark:text-slate-800 focus:outline-none"
                onChange={(e) => i18n.changeLanguage(e.target.value)}
              >
                <option value="en">{t('login.lang_en')}</option>
                <option value="or">{t('login.lang_or')}</option>
                <option value="am">{t('login.lang_am')}</option>
                <option value="hr">{t('login.lang_hr')}</option>
              </select>
              <ChevronDown
                aria-hidden="true"
                className="pointer-events-none absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-200 dark:text-slate-800"
              />
            </div>
          </div>
        </div>

        <div className="hidden md:flex flex-col justify-between relative">
          <div className="relative bg-black/30 dark:bg-slate-200 rounded-l-3xl h-full flex flex-col justify-center">
            <img src={companyLogo} alt="Company Logo" className="mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}