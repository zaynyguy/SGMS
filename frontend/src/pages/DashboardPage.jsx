import React, { useState } from 'react';
import StatsCard from '../Components/Dashboard-components/StatsCard';
import LineChartCard from '../Components/Dashboard-components/LineChart';
import PieChartCard from '../Components/Dashboard-components/PieChart';
import RecentActivityList from '../Components/Dashboard-components/RecentActivity';
import QuickActionsPanel from '../Components/Dashboard-components/QuickActions';
import { BellIcon } from 'lucide-react'

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="sticky top-0 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden text-gray-500 dark:text-gray-400 mr-3"
            >
              <i className="fas fa-bars" />
            </button>
            <h1 className="font-bold text-xl">Dashboard</h1>
          </div>
          <div className="flex items-center space-x-4 w-full mx-10">
            <input
              type="text"
              placeholder="Search..."
              className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 w-full"
            />
          </div>
          <BellIcon/>
        </div>
      </header>

      <div className="flex flex-1">
        <main className="flex-1 p-4 overflow-y-auto">
          <h1 className="text-2xl font-bold mb-4">Dashboard Overview</h1>
          <div className="grid grid-cols-12 gap-4">  
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <StatsCard title="Companies Reporting" value="142" iconClass="bg-blue-100" trend="+12% from last month" trendColor="text-green-500" />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <StatsCard title="Projects Due" value="24" iconClass="bg-purple-100" trend="-3% from last month" trendColor="text-red-500" />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <StatsCard title="Overdue Activities" value="8" iconClass="bg-orange-100" trend="-15% from last month" trendColor="text-green-500" />
            </div>
            <div className="col-span-12 md:col-span-6 lg:col-span-3">
              <StatsCard title="Attachments Uploaded" value="327" iconClass="bg-green-100" trend="+22% from last month" trendColor="text-green-500" />
            </div>

            <div className="col-span-12 lg:col-span-6">
              <LineChartCard />
            </div>
            <div className="col-span-12 lg:col-span-6">
              <PieChartCard />
            </div>

            <div className="col-span-12 lg:col-span-8">
              <RecentActivityList />
            </div>
            <div className="col-span-12 lg:col-span-4">
              <QuickActionsPanel />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
