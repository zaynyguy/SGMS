import { useTranslation } from 'react-i18next';

export default function Dashboard() {
    const { t } = useTranslation();
    
    return(
        <h1 className="text-2xl flex justify-center items-center h-screen">
            {t('dashboard.title')}
        </h1>
    )
}