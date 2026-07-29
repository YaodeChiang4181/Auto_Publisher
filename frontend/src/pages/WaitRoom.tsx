import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LockKeyhole, Sparkles, MessageCircleWarning } from 'lucide-react';

const WaitRoom = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lineStatus, setLineStatus] = useState<'prompt' | 'linked' | 'failed'>('prompt');
  const [timeLeft, setTimeLeft] = useState(15); // dummy countdown for visual
  const eventId = localStorage.getItem('eventId');

  useEffect(() => {
    if (!eventId) {
      navigate('/', { replace: true });
      return;
    }

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/session/status`);
        const data = await res.json();
        
        if (data.isUnlocked) {
          navigate(`/unlock/${eventId}`, { replace: true });
        } else if (data.unlockTime) {
          // 計算剩餘秒數
          const remainingSecs = Math.max(0, Math.floor((new Date(data.unlockTime).getTime() - Date.now()) / 1000));
          setTimeLeft(remainingSecs);
        }
      } catch (e) {
        console.error('Status fetch error', e);
      }
    };

    fetchStatus();
    // Polling fallback every 3s
    const pollInterval = setInterval(fetchStatus, 3000);

    return () => clearInterval(pollInterval);
  }, [navigate, eventId]);

  // Visual countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check URL parameters for LINE Login return status
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('line_linked') === 'true') {
      setLineStatus('linked');
      // Clean up URL to avoid confusing users if they refresh
      window.history.replaceState({}, document.title, location.pathname);
    } else if (searchParams.get('error') === 'auth_failed') {
      setLineStatus('failed');
      window.history.replaceState({}, document.title, location.pathname);
    }
  }, [location]);

  const handleLineLogin = () => {
    // 透過 Vite Proxy 導向後端的 LINE Login API
    window.location.href = '/api/line/auth';
  };

  return (
    <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
      <LockKeyhole size={64} color="var(--accent-secondary)" style={{ margin: '0 auto', display: 'block', marginBottom: '1.5rem' }} />
      <h1 className="title-gradient" style={{ fontSize: '2rem', marginBottom: '1rem' }}>
        時間鎖已啟動
      </h1>
      <p className="text-muted" style={{ marginBottom: '2.5rem', lineHeight: 1.6 }}>
        活動尚未結束，為了維持最純粹的體驗，深度解析與彩蛋將在 {timeLeft > 0 ? `${timeLeft}秒後` : '即將'} 自動解鎖。
      </p>

      {lineStatus === 'prompt' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px' }}>
          <svg style={{ margin: '0 auto', display: 'block', marginBottom: '1rem' }} width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.5 10.972C22.5 5.568 17.794 1.188 12 1.188C6.206 1.188 1.5 5.568 1.5 10.972C1.5 15.82 5.213 19.866 10.024 20.612C10.372 20.732 11.233 21.05 11.391 21.725C11.458 22.015 11.285 23.364 11.285 23.364C11.285 23.364 11.218 24.167 12.394 24.167C13.57 24.167 18.736 21.135 20.785 18.455C21.849 16.592 22.5 14.162 22.5 10.972Z" fill="#06C755"/></svg>
          <h3 style={{ marginBottom: '0.5rem' }}>不想乾等？</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            登入 LINE 並加好友，您可以直接關閉螢幕，解鎖時我們將立刻通知您。
          </p>
          <button className="btn-primary" style={{ width: '100%', background: '#06C755', color: '#fff' }} onClick={handleLineLogin}>
            LINE 登入並接收通知
          </button>
        </div>
      )}

      {lineStatus === 'linked' && (
        <div style={{ background: 'rgba(74, 222, 128, 0.1)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
          <Sparkles size={32} color="#4ade80" style={{ margin: '0 auto', display: 'block', marginBottom: '1rem' }} />
          <h3 style={{ color: '#4ade80', marginBottom: '0.5rem' }}>✅ 已綁定 LINE 官方帳號</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            您可以安全地將手機收起，或切換至其他 App，解鎖時將自動透過 LINE 通知您。
          </p>
        </div>
      )}

      {lineStatus === 'failed' && (
        <div style={{ background: 'rgba(248, 113, 113, 0.1)', padding: '1.5rem', borderRadius: '16px' }}>
          <MessageCircleWarning size={32} color="#f87171" style={{ margin: '0 auto', display: 'block', marginBottom: '1rem' }} />
          <h3 style={{ color: '#f87171', marginBottom: '0.5rem' }}>綁定失敗</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>
            請確認您的網路連線或重新嘗試授權。
          </p>
          <button className="btn-primary" style={{ width: '100%', background: 'transparent', border: '1px solid #f87171', color: '#f87171' }} onClick={handleLineLogin}>
            重新嘗試綁定
          </button>
        </div>
      )}
    </div>
  );
};

export default WaitRoom;
