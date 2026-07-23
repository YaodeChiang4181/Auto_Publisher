import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, LockKeyhole, Sparkles } from 'lucide-react';

const WaitRoom = () => {
  const navigate = useNavigate();
  const [pushStatus, setPushStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
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
          navigate('/unlock', { replace: true });
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

  const enablePush = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setPushStatus('granted');
        // Retrieve public key from backend
        const res = await fetch('/health');
        const { vapidPublicKey } = await res.json();
        
        // Register SW and subscribe
        const registration = await navigator.serviceWorker.register('/sw.js');
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidPublicKey
        });

        // Send to backend
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        });
      } else {
        setPushStatus('denied');
      }
    } catch (error) {
      console.error('Failed to enable push', error);
      setPushStatus('denied');
    }
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

      {pushStatus === 'prompt' && (
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '1.5rem', borderRadius: '16px' }}>
          <Bell size={32} color="var(--accent-primary)" style={{ margin: '0 auto', display: 'block', marginBottom: '1rem' }} />
          <h3 style={{ marginBottom: '0.5rem' }}>不想乾等？</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            開啟離場推播通知，您可以直接關閉螢幕，時間一到我們立刻通知您。
          </p>
          <button className="btn-primary" style={{ width: '100%' }} onClick={enablePush}>
            開啟解鎖推播
          </button>
        </div>
      )}

      {pushStatus === 'granted' && (
        <div style={{ background: 'rgba(74, 222, 128, 0.1)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(74, 222, 128, 0.2)' }}>
          <Sparkles size={32} color="#4ade80" style={{ margin: '0 auto', display: 'block', marginBottom: '1rem' }} />
          <h3 style={{ color: '#4ade80', marginBottom: '0.5rem' }}>已開啟無縫推播</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            您可以安全地將手機收起，或切換至其他 App，解鎖時將自動通知您。
          </p>
        </div>
      )}

      {pushStatus === 'denied' && (
        <div style={{ background: 'rgba(248, 113, 113, 0.1)', padding: '1.5rem', borderRadius: '16px' }}>
          <BellOff size={32} color="#f87171" style={{ margin: '0 auto', display: 'block', marginBottom: '1rem' }} />
          <p className="text-muted" style={{ fontSize: '0.9rem' }}>
            您已拒絕推播權限。請保持此頁面開啟，我們將為您自動輪詢解鎖狀態。
          </p>
        </div>
      )}
    </div>
  );
};

export default WaitRoom;
