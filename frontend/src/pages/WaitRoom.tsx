import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, BellOff, LockKeyhole, Sparkles, AlertTriangle } from 'lucide-react';

const isIos = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};

const isInStandaloneMode = () => {
  return ('standalone' in window.navigator) && (window.navigator as any).standalone;
};

const WaitRoom = () => {
  const navigate = useNavigate();
  const [pushStatus, setPushStatus] = useState<'prompt' | 'granted' | 'denied'>('prompt');
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
      navigate('/', { replace: true });
      return;
    }

    const eventSource = new EventSource('/api/session/sse');

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.isUnlocked) {
          eventSource.close();
          
          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              const reg = await navigator.serviceWorker.ready;
              await reg.showNotification(`彩蛋已解鎖！`, {
                body: `您等待的活動已經解鎖，為您導向至解析頁面！`,
              });
            } catch (e) {}
            // 給予 1.5 秒讓推播橫幅有時間彈出
            setTimeout(() => navigate(`/unlock/${eventId}`, { replace: true }), 1500);
          } else {
            navigate(`/unlock/${eventId}`, { replace: true });
          }
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

  const showIosPrompt = isIos() && !isInStandaloneMode();

  const enablePush = async () => {
    try {
      if (!('Notification' in window)) {
        throw new Error('此瀏覽器不支援推播通知');
      }
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        // Retrieve public key from backend (via /api/health to bypass Vite proxy issues without restart)
        const res = await fetch('/api/health');
        if (!res.ok) throw new Error('無法取得推播金鑰');
        const { vapidPublicKey } = await res.json();
        
        // Register SW and wait until it's active
        await navigator.serviceWorker.register('/sw.js');
        const readyRegistration = await navigator.serviceWorker.ready;
        
        const subscription = await readyRegistration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidPublicKey
        });

        // Send to backend
        const subRes = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subscription })
        });
        if (!subRes.ok) throw new Error('無法向伺服器註冊推播');

        // 一切都成功後才改變狀態，避免畫面閃爍
        setPushStatus('granted');
      } else {
        setPushStatus('denied');
      }
    } catch (error: any) {
      console.error('Failed to enable push', error);
      alert(`啟用推播失敗: ${error.message || error}`);
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

      {showIosPrompt && (
        <div style={{ background: 'rgba(250, 204, 21, 0.1)', padding: '1.5rem', borderRadius: '16px', marginBottom: '1.5rem', border: '1px solid rgba(250, 204, 21, 0.3)' }}>
          <AlertTriangle size={32} color="#facc15" style={{ margin: '0 auto', display: 'block', marginBottom: '1rem' }} />
          <h3 style={{ color: '#facc15', marginBottom: '0.5rem' }}>iOS 系統用戶注意！</h3>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: 0 }}>
            煩請點擊下方分享按鈕將網頁「加入主畫面」，並從主畫面開啟，這樣您才會收到最即時的推播資訊喔！
          </p>
        </div>
      )}

      {pushStatus === 'prompt' && !showIosPrompt && (
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
