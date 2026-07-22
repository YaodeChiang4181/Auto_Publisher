import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const VenueScreen = () => {
  const [token, setToken] = useState<string | null>(null);
  // Example dummy IDs for the venue display
  const eventId = "demo-event-id"; 
  const venueId = "demo-venue-id";

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch(`/api/qr/token?eventId=${eventId}&venueId=${venueId}`);
        const data = await res.json();
        if (data.token) setToken(data.token);
      } catch (err) {
        console.error('Failed to fetch token', err);
      }
    };

    fetchToken();
    const interval = setInterval(fetchToken, 5000); // Poll every 5s per dynamic QR design
    return () => clearInterval(interval);
  }, []);

  // For testing convenience, click the QR code to simulate a scan
  const scanUrl = `${window.location.origin}/scan?token=${token}`;

  return (
    <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem' }}>
      <h1 className="title-gradient" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>
        掃碼解鎖專屬彩蛋
      </h1>
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
            載入中...
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
