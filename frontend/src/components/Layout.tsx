import { useEffect, useRef } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import ToastContainer from './ToastContainer';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import axiosInstance from '../utils/axiosConfig';

function Layout() {
  const { role, userId, isAuthenticated } = useAuthStore();
  const addToast = useToastStore((state) => state.addToast);
  const lastCheckedCount = useRef<number>(0);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Only check for RMs and Financial Managers
    if (!isAuthenticated || (role !== 'relationship_mgr' && role !== 'financial_manager')) {
      return;
    }

    let isFirstCheck = true;

    const checkNewLeads = async () => {
      try {
        const res = await axiosInstance.get('/leads/new-count');
        const { newLeadsCount } = res.data;
        
        // On first check, skip notification (already shown on login)
        // On subsequent checks, show notification if count increased
        if (!isFirstCheck && newLeadsCount > lastCheckedCount.current) {
          const newCount = newLeadsCount - lastCheckedCount.current;
          addToast(
            `You have been assigned ${newCount} new lead${newCount > 1 ? 's' : ''}!`,
            'info'
          );
        }
        
        lastCheckedCount.current = newLeadsCount;
        isFirstCheck = false;
      } catch (err) {
        console.error('Failed to check new leads:', err);
      }
    };

    // Check immediately on mount (but don't show notification on first check)
    checkNewLeads();

    // Then check every 30 seconds
    checkIntervalRef.current = setInterval(checkNewLeads, 30000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [isAuthenticated, role, userId, addToast]);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-900 text-white">
      {/* Fixed Sidebar */}
      <div className="flex-shrink-0 w-64 h-full">
        <Sidebar />
      </div>

      {/* Scrollable Main Content */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}

export default Layout;
