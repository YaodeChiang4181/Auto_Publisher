// React 17+ does not need explicit React import
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import VenueScreen from './pages/VenueScreen';
import ScanPage from './pages/ScanPage';
import WaitRoom from './pages/WaitRoom';
import UnlockPage from './pages/UnlockPage';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

const App = () => {
  return (
    <Router>
      <div className="bg-glow"></div>
      <div className="container">
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
    </Router>
  );
};

export default App;
