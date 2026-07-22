// React 17+ does not need explicit React import
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import VenueScreen from './pages/VenueScreen';
import ScanPage from './pages/ScanPage';
import WaitRoom from './pages/WaitRoom';
import UnlockPage from './pages/UnlockPage';
import './index.css';

const App = () => {
  return (
    <Router>
      <div className="bg-glow"></div>
      <div className="container">
        <Routes>
          <Route path="/" element={<VenueScreen />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/wait" element={<WaitRoom />} />
          <Route path="/unlock" element={<UnlockPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
