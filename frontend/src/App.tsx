// React 17+ does not need explicit React import
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import VenueScreen from './pages/VenueScreen';
import ScanPage from './pages/ScanPage';
import WaitRoom from './pages/WaitRoom';
import UnlockPage from './pages/UnlockPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

const AppContent = () => {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith('/admin/dashboard');
  const isUnlock = location.pathname.startsWith('/unlock');
  // 針對後台與解鎖頁面使用較寬的排版，其餘維持 600px 手機版寬度
  const containerClass = (isDashboard || isUnlock) ? 'dashboard-container' : 'container';

  return (
    <div className={containerClass}>
      <Routes>
        <Route path="/" element={<Navigate to="/admin/login" replace />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/kiosk/:venueId/:eventId" element={<VenueScreen />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/wait" element={<WaitRoom />} />
        <Route path="/unlock/:eventId" element={<UnlockPage />} />
        <Route path="*" element={<Navigate to="/admin/login" replace />} />
      </Routes>
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <div className="bg-glow"></div>
      <AppContent />
    </Router>
  );
};

export default App;
