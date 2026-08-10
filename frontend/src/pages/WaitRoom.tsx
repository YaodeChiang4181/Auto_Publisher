import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LockKeyhole, Sparkles, MessageCircleWarning } from 'lucide-react';

const WaitRoom = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [lineStatus, setLineStatus] = useState<'prompt' | 'linked' | 'failed'>('prompt');
  const [timeLeft, setTimeLeft] = useState(15); // dummy countdown for visual
  const eventId = localStorage.getItem('eventId');

  const [ads, setAds] = useState<{ central: any[], venue: any[] }>({ central: [], venue: [] });
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isCentralAd, setIsCentralAd] = useState(true);

  const trackAction = async (actionType: string) => {
    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, actionType })
      });
    } catch (e) {}
  };

  // Fetch Ads for WaitRoom
  useEffect(() => {
    if (!eventId) return;
    const fetchAds = async () => {
      try {
        const res = await fetch(`/api/unlock/ads/${eventId}`);
        if (res.ok) {
          const data = await res.json();
          setAds(data);
          if (data.central?.length === 0 && data.venue?.length > 0) {
            setIsCentralAd(false);
          }
        }
      } catch (e) {
        console.error('Failed to fetch ads', e);
      }
    };
    fetchAds();
  }, [eventId]);

  // Ad rotation logic
  useEffect(() => {
    const interval = setInterval(() => {
      setIsCentralAd(prev => {
        const willBeCentral = !prev;
        const adArray = willBeCentral ? ads.central : ads.venue;
        
        if (!adArray || adArray.length === 0) {
          const currentArray = prev ? ads.central : ads.venue;
          if (currentArray && currentArray.length > 0) {
             setCurrentAdIndex(idx => (idx + 1) % currentArray.length);
          }
          return prev; 
        }
        
        setCurrentAdIndex(0);
        return willBeCentral;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [ads]);

  useEffect(() => {
    if (!eventId) {
      navigate('/scan', { replace: true });
      return;
    }

    const eventSource = new EventSource('/api/session/sse');

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.isUnlocked) {
          navigate(`/unlock/${eventId}`, { replace: true });
        } else if (data.unlockTime) {
          // 計算剩餘秒數
          const remainingSecs = Math.max(0, Math.floor((new Date(data.unlockTime).getTime() - Date.now()) / 1000));
          setTimeLeft(remainingSecs);
        }
      } catch (err) {
        console.error('SSE Message parsing error', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE connection error', err);
      // EventSource 預設會自動重連，但如果真的發生錯誤可以記錄下來
    };

    return () => {
      eventSource.close();
    };
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

      {/* Interactive Ad Block for Wait Room */}
      {(() => {
        const currentAdArray = isCentralAd ? ads.central : ads.venue;
        const currentAd = currentAdArray && currentAdArray.length > 0 ? currentAdArray[currentAdIndex] : null;
        
        if (!currentAd) return null;
        
        return (
          <div style={{ marginTop: '2rem' }}>
            {currentAd.linkUrl ? (
              <a 
                href={currentAd.linkUrl}
                target="_blank"
                rel="noreferrer"
                onClick={() => trackAction('CLICK_AD')}
                className="glass-panel"
                style={{
                  display: 'block',
                  padding: 0,
                  overflow: 'hidden',
                  textDecoration: 'none',
                  color: 'inherit',
                  position: 'relative',
                  transition: 'transform 0.3s',
                  animation: 'fade-in 0.5s'
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', color: '#fff', zIndex: 10 }}>
                  Sponsored ({currentAd.type === 'CENTRAL' ? 'Platform' : 'Venue'})
                </div>
                {currentAd.imageUrl && (
                  <div style={{ width: '100%', height: '160px', overflow: 'hidden' }}>
                    <img src={currentAd.imageUrl} alt="Ad" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ padding: '1.5rem', background: 'linear-gradient(to right, rgba(255,255,255,0.05), transparent)', textAlign: 'left' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>{currentAd.title}</h3>
                  <p className="text-muted" style={{ fontSize: '0.9rem' }}>{currentAd.description}</p>
                </div>
              </a>
            ) : (
              <div 
                className="glass-panel"
                style={{
                  display: 'block',
                  padding: 0,
                  overflow: 'hidden',
                  color: 'inherit',
                  position: 'relative',
                  animation: 'fade-in 0.5s',
                  textAlign: 'left'
                }}
              >
                <div style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(0,0,0,0.6)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', color: '#fff', zIndex: 10 }}>
                  Sponsored ({currentAd.type === 'CENTRAL' ? 'Platform' : 'Venue'})
                </div>
                {currentAd.imageUrl && (
                  <div style={{ width: '100%', height: '160px', overflow: 'hidden' }}>
                    <img src={currentAd.imageUrl} alt="Ad" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ padding: '1.5rem', background: 'linear-gradient(to right, rgba(255,255,255,0.05), transparent)' }}>
                  <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>{currentAd.title}</h3>
                  <p className="text-muted" style={{ fontSize: '0.9rem' }}>{currentAd.description}</p>
                </div>
              </div>
            )}
          </div>
        );
      })()}
      
      <style>{`
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default WaitRoom;
