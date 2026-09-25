import { useState, useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import { Menu } from 'lucide-react';
import { prefetchGoldForecast } from '../../utils/goldForecastCache';

const DashboardLayout = () => {
    const isAuthenticated = localStorage.getItem('shopowner_auth') === 'true';
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    useEffect(() => {
        prefetchGoldForecast();
    }, []);

    if (!isAuthenticated) {
        return <Navigate to="/signin" replace />;
    }

    return (
        <div className="min-h-screen bg-[#050608] text-white flex relative">
            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/80 z-40 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

            <div className="flex-1 w-full md:ml-64 p-4 md:p-8 transition-all duration-300">
                {/* Mobile Header / Toggle */}
                <div className="md:hidden mb-6 flex items-center justify-between">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 bg-[#121418] border border-white/10 rounded-xl text-primary-gold"
                    >
                        <Menu size={24} />
                    </button>
                    <span className="text-primary-gold font-bold tracking-wider">GOLD RUSH</span>
                    <div className="w-10"></div> {/* Spacer for centering if needed, or just empty */}
                </div>

                <Outlet />
            </div>
        </div>
    );
};

export default DashboardLayout;
