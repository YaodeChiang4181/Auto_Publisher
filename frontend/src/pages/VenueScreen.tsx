import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
  const { eventId } = useParams<{ eventId?: string; venueId?: string }>();
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

        // 如果是從 Kiosk 模式進入，自動選擇該活動
        if (eventId && data.length > 0) {
          const target = data.find((e: EventData) => e.id === eventId);
          if (target) setSelectedEvent(target);
        }
      } catch (err) {
        console.error('Failed to fetch events', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [eventId]);

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

  // View 1: Event Selection (Only if not in Kiosk mode)
  if (!selectedEvent) {
    if (eventId) {
       return <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>找不到該場次，或該場次已結束。</div>;
    }

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
            <div className="text-muted" style={{ textAlign: 'center' }}>目前沒有進行中的活動。</div>
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
    <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', position: 'relative', minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
      {!eventId && ( // 如果不是 Kiosk 模式，才顯示返回按鈕
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
      )}

      <h1 className="title-gradient" style={{ fontSize: '3.5rem', marginBottom: '1.5rem', marginTop: eventId ? '0' : '2rem' }}>
        掃碼解鎖專屬彩蛋
      </h1>
      <p className="text-muted" style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
        放映中：{selectedEvent.name}
      </p>
      <p className="text-muted" style={{ fontSize: '1.2rem', marginBottom: '3rem' }}>
        {selectedEvent.venue.name}
      </p>

      <div style={{ background: 'white', padding: '2rem', borderRadius: '24px', display: 'inline-block', boxShadow: '0 0 40px rgba(0, 163, 255, 0.2)' }}>
        {token ? (
          <a href={scanUrl} target="_blank" rel="noreferrer" title="點擊模擬掃描">
            <QRCodeSVG value={scanUrl} size={360} />
          </a>
        ) : (
          <div style={{ width: 360, height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: '1.5rem' }}>
            載入動態碼中...
          </div>
        )}
      </div>
      
      <div style={{ marginTop: '3rem', color: 'var(--accent-primary)', fontWeight: 600, fontSize: '1.5rem' }}>
        100% 防爆雷防護・無需下載 App
      </div>
    </div>
  );
};

export default VenueScreen;
