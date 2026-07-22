import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface EventData {
  id: string;
  name: string;
  startTime: string;
  unlockTime: string;
  venueId: string;
  venue: {
    id: string;
    name: string;
  };
}

const VenueScreen = () => {
  const [events, setEvents] = useState<EventData[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch active events on mount
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/events/active');
        const data = await res.json();
        setEvents(data);
      } catch (err) {
        console.error('Failed to fetch events', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, []);

  // Handle polling when an event is selected
  useEffect(() => {
    if (!selectedEvent) {
      setToken(null);
      return;
    }

    const fetchToken = async () => {
      try {
        const res = await fetch(`/api/qr/token?eventId=${selectedEvent.id}&venueId=${selectedEvent.venueId}`);
        const data = await res.json();
        if (data.token) setToken(data.token);
      } catch (err) {
        console.error('Failed to fetch token', err);
      }
    };

    fetchToken();
    const interval = setInterval(fetchToken, 5000); // Poll every 5s per dynamic QR design
    return () => clearInterval(interval);
  }, [selectedEvent]);

  if (loading) {
    return <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>載入場次資料中...</div>;
  }

  // View 1: Event Selection
  if (!selectedEvent) {
    return (
      <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', margin: '0 auto', padding: '3rem' }}>
        <h1 className="title-gradient" style={{ fontSize: '2rem', marginBottom: '1rem', textAlign: 'center' }}>
          選擇正在放映的場次
        </h1>
        <p className="text-muted" style={{ marginBottom: '2rem', textAlign: 'center' }}>
          請選擇您要產生數位看板 QR Code 的電影與場館
        </p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {events.length === 0 ? (
            <div className="text-muted" style={{ textAlign: 'center' }}>目前沒有進行中的活動。請確認爬蟲是否正常執行。</div>
          ) : (
            events.map(e => (
              <div 
                key={e.id}
                onClick={() => setSelectedEvent(e)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
                onMouseOver={(ev) => {
                  (ev.currentTarget as HTMLDivElement).style.background = 'rgba(255, 255, 255, 0.1)';
                  (ev.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255, 255, 255, 0.3)';
                }}
                onMouseOut={(ev) => {
                  (ev.currentTarget as HTMLDivElement).style.background = 'rgba(255, 255, 255, 0.05)';
                  (ev.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '1.2rem', color: '#fff', marginBottom: '0.5rem' }}>{e.name}</div>
                  <div className="text-muted" style={{ fontSize: '0.9rem' }}>{e.venue.name}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '0.2rem' }}>開始: {new Date(e.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="text-muted" style={{ fontSize: '0.9rem' }}>結束: {new Date(e.unlockTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // View 2: QR Code Display for selected event
  const scanUrl = `${window.location.origin}/scan?token=${token}`;

  return (
    <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', position: 'relative' }}>
      <button 
        onClick={() => setSelectedEvent(null)}
        style={{
          position: 'absolute',
          top: '2rem',
          left: '2rem',
          background: 'rgba(255,255,255,0.1)',
          border: '1px solid rgba(255,255,255,0.2)',
          color: 'white',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          cursor: 'pointer',
          transition: 'all 0.2s'
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
      >
        ← 返回列表
      </button>

      <h1 className="title-gradient" style={{ fontSize: '2.5rem', marginBottom: '1rem', marginTop: '2rem' }}>
        掃碼解鎖專屬彩蛋
      </h1>
      <p className="text-muted" style={{ marginBottom: '0.5rem' }}>
        放映中：{selectedEvent.name} ({selectedEvent.venue.name})
      </p>
      <p className="text-muted" style={{ marginBottom: '2rem' }}>
        動態密碼保護中，請使用相機掃描
      </p>

      <div style={{ background: 'white', padding: '1rem', borderRadius: '16px', display: 'inline-block' }}>
        {token ? (
          <a href={scanUrl} target="_blank" rel="noreferrer" title="點擊模擬掃描">
            <QRCodeSVG value={scanUrl} size={256} />
          </a>
        ) : (
          <div style={{ width: 256, height: 256, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
            載入動態碼中...
          </div>
        )}
      </div>
      
      <div style={{ marginTop: '2rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
        100% 防爆雷防護・無需下載 App
      </div>
    </div>
  );
};

export default VenueScreen;
