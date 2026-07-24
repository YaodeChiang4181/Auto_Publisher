import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // Venue state
  const [venueName, setVenueName] = useState<string>('');
  const [geoLat, setGeoLat] = useState<string>('');
  const [geoLng, setGeoLng] = useState<string>('');
  const [geoRadiusKm, setGeoRadiusKm] = useState<string>('');
  const [isUpdatingVenue, setIsUpdatingVenue] = useState(false);

  // Ad upload state
  const [adTitle, setAdTitle] = useState('');
  const [adDescription, setAdDescription] = useState('');
  const [adLinkUrl, setAdLinkUrl] = useState('');
  const [adFile, setAdFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Manual event state
  const [newEventName, setNewEventName] = useState('');
  const [newEventStartTime, setNewEventStartTime] = useState('');
  const [newEventUnlockTime, setNewEventUnlockTime] = useState('');

  // 2FA state
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [setup2FAMode, setSetup2FAMode] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const userData = localStorage.getItem('adminUser');
    if (!userData) {
      navigate('/admin/login');
      return;
    }

    const fetchData = async () => {
      try {
        const [meRes, eventsRes, adsRes] = await Promise.all([
          fetch('/api/admin/me'),
          fetch('/api/admin/events'),
          fetch('/api/admin/ads')
        ]);

        if (meRes.status === 401 || eventsRes.status === 401) {
          localStorage.removeItem('adminUser');
          navigate('/admin/login');
          return;
        }

        const meData = await meRes.json();
        const eventsData = await eventsRes.json();
        const adsData = await adsRes.json();

        setUser(meData.user);
        setEvents(eventsData);
        setAds(adsData);
        setIs2FAEnabled(meData.user.isTwoFactorEnabled);
        
        if (meData.user.venue) {
          setVenueName(meData.user.venue.name || meData.user.username || '');
          setGeoLat(meData.user.venue.geoLat.toString());
          setGeoLng(meData.user.venue.geoLng.toString());
          setGeoRadiusKm((meData.user.venue.geoRadius / 1000).toString());
        }

      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleStartKiosk = (eventId: string, venueId: string) => {
    navigate(`/kiosk/${venueId}/${eventId}`);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (e) {
      console.error('Logout error', e);
    }
    localStorage.removeItem('adminUser');
    navigate('/admin/login');
  };

  const handleUpdateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingVenue(true);
    
    try {
      const radiusMeters = parseFloat(geoRadiusKm) * 1000;
      await fetch('/api/admin/venue', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: venueName, geoLat, geoLng, geoRadius: radiusMeters })
      });
      alert('場館設定更新成功！');
    } catch (e) {
      alert('無法更新場館設定。');
    } finally {
      setIsUpdatingVenue(false);
    }
  };

  const handleGetGeolocation = () => {
    if (!navigator.geolocation) {
      alert('您的瀏覽器不支援地理位置功能');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoLat(position.coords.latitude.toFixed(6));
        setGeoLng(position.coords.longitude.toFixed(6));
      },
      (error) => {
        console.error(error);
        alert('無法取得您的位置，請確認是否已授權瀏覽器存取位置資訊。');
      },
      { enableHighAccuracy: true }
    );
  };

  const handleSaveLocation = async () => {
    if (!geoLat || !geoLng) {
      alert('請先填寫經緯度（或使用抓取功能），才能儲存！');
      return;
    }
    const locations = user?.savedLocations || [];
    if (locations.length >= 5) {
      alert('常用位置最多只能儲存 5 筆，請先刪除舊的再儲存！');
      return;
    }

    const name = prompt('請為這個常用位置命名（例如：松菸文創）：');
    if (!name) return;

    try {
      const res = await fetch('/api/admin/saved-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, lat: geoLat, lng: geoLng })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      
      setUser({ ...user, savedLocations: data.savedLocations });
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteLocation = async (index: number) => {
    if (!confirm('確定要刪除這個常用位置嗎？')) return;
    try {
      const res = await fetch(`/api/admin/saved-locations/${index}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      
      setUser({ ...user, savedLocations: data.savedLocations });
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleGenerate2FA = async () => {
    try {
      const res = await fetch('/api/admin/2fa/generate', {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate 2FA');
      if (data.qrCodeUrl) {
        setQrCodeUrl(data.qrCodeUrl);
        setSetup2FAMode(true);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/2fa/enable', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: twoFactorCode })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid 2FA code');
      
      alert('2FA 雙重驗證啟用成功！請使用新核發的憑證重新登入。');
      handleLogout();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newEventName, 
          startTime: new Date(newEventStartTime).toISOString(), 
          unlockTime: new Date(newEventUnlockTime).toISOString() 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create event');
      setEvents([...events, data].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
      setNewEventName('');
      setNewEventStartTime('');
      setNewEventUnlockTime('');
      alert('活動建立成功！');
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm('確定要刪除此活動嗎？')) return;
    try {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete event');
      }
      setEvents(events.filter(e => e.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert('檔案大小超過 5MB 限制。');
        e.target.value = '';
        return;
      }
      setAdFile(file);
    }
  };

  const handleUploadAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adFile && !adLinkUrl) {
      alert('請至少提供「廣告連結 (Link URL)」或「圖片/動畫檔案 (Image/Animation)」其中一項。');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('title', adTitle);
      formData.append('description', adDescription);
      formData.append('linkUrl', adLinkUrl);
      if (adFile) {
        formData.append('image', adFile);
      }

      const res = await fetch('/api/admin/ads', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const newAd = await res.json();
      setAds([newAd, ...ads]);
      
      // Reset form
      setAdTitle('');
      setAdDescription('');
      setAdLinkUrl('');
      setAdFile(null);
      (document.getElementById('adFileInput') as HTMLInputElement).value = '';
      alert('廣告上傳成功！');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAd = async (id: string) => {
    if (!confirm('確定要刪除這個廣告嗎？')) return;
    try {
      const res = await fetch(`/api/admin/ads/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAds(ads.filter(ad => ad.id !== id));
      } else {
        alert('無法刪除廣告');
      }
    } catch (e) {
      alert('刪除廣告時發生錯誤');
    }
  };

  if (loading) {
    return <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', margin: '2rem auto', maxWidth: '400px' }}>載入中...</div>;
  }

  return (
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="title-gradient" style={{ fontSize: '2rem', margin: 0 }}>AutoPublisher B2B</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="text-muted">歡迎, {user?.name || user?.username}</span>
          <button 
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,100,100,0.5)',
              color: '#ff6b6b',
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            登出
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        {/* Venue Location Settings */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'white' }}>場域地理圍欄設定</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            設定此場館的地理邊界，以及場館顯示名稱。在半徑外掃描 QR Code 的使用者將會被標記為未驗證狀態。
          </p>
          <form onSubmit={handleUpdateVenue} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>場館名稱 (顯示在 Kiosk 數位看板)</label>
              <input type="text" value={venueName} onChange={e => setVenueName(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="例如：信義威秀影城" />
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>緯度 (Latitude)</label>
                <input type="text" value={geoLat} onChange={e => setGeoLat(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>經度 (Longitude)</label>
                <input type="text" value={geoLng} onChange={e => setGeoLng(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} />
              </div>
              <button type="button" onClick={handleGetGeolocation} style={{ padding: '0.5rem 1rem', background: 'rgba(0,163,255,0.2)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)', borderRadius: '4px', cursor: 'pointer', whiteSpace: 'nowrap' }} title="自動定位目前裝置">
                📍 抓取目前位置
              </button>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>半徑範圍 (公里)</label>
              <input type="number" step="0.1" value={geoRadiusKm} onChange={e => setGeoRadiusKm(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} />
            </div>
            
            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
              <button type="submit" disabled={isUpdatingVenue} style={{ flex: 2, padding: '0.6rem', background: 'var(--accent-secondary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                {isUpdatingVenue ? '更新中...' : '儲存場域設定'}
              </button>
              <button type="button" onClick={handleSaveLocation} style={{ flex: 1, padding: '0.6rem', background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px', cursor: 'pointer' }}>
                💾 儲存為常用
              </button>
            </div>
          </form>

          {/* Saved Locations Memory Bank */}
          {(user?.savedLocations && user.savedLocations.length > 0) && (
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ fontSize: '1rem', color: 'white', marginBottom: '1rem' }}>🔖 常用位置記憶庫 ({user.savedLocations.length}/5)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                {user.savedLocations.map((loc: any, idx: number) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.05)', padding: '0.6rem 1rem', borderRadius: '8px' }}>
                    <div 
                      style={{ cursor: 'pointer', flex: 1 }}
                      onClick={() => {
                        setGeoLat(loc.lat.toString());
                        setGeoLng(loc.lng.toString());
                      }}
                      title="點擊帶入此座標"
                    >
                      <strong style={{ color: 'var(--accent-primary)', display: 'block', marginBottom: '0.2rem' }}>{loc.name}</strong>
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>{loc.lat}, {loc.lng}</span>
                    </div>
                    <button 
                      onClick={() => handleDeleteLocation(idx)}
                      style={{ background: 'transparent', border: 'none', color: '#ff6b6b', cursor: 'pointer', fontSize: '1.2rem', padding: '0.5rem' }}
                      title="刪除"
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Security Settings */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'white' }}>安全設定</h2>
          
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', marginBottom: '0.3rem' }}>雙重驗證 (2FA)</strong>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>每 24 小時需輸入一次 6 位數動態密碼。</span>
              </div>
              <div>
                {is2FAEnabled ? (
                  <span style={{ color: '#4ade80', fontWeight: 'bold' }}>✓ 已啟用</span>
                ) : (
                  <button onClick={handleGenerate2FA} style={{ padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', borderRadius: '4px', cursor: 'pointer' }}>
                    啟用 2FA
                  </button>
                )}
              </div>
            </div>
            
            {setup2FAMode && !is2FAEnabled && (
              <div style={{ marginTop: '1.5rem', textAlign: 'center', padding: '1rem', background: 'white', borderRadius: '8px' }}>
                <img src={qrCodeUrl} alt="2FA QR Code" style={{ width: '150px', height: '150px', marginBottom: '1rem' }} />
                <p style={{ color: 'black', fontSize: '0.9rem', marginBottom: '1rem' }}>請使用 Google Authenticator 掃描</p>
                <form onSubmit={handleEnable2FA} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" maxLength={6} required value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value)} placeholder="000000" style={{ flex: 1, padding: '0.5rem', textAlign: 'center', letterSpacing: '0.2rem', border: '1px solid #ccc', borderRadius: '4px', color: 'black' }} />
                  <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent-primary)', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>驗證並啟用</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'white' }}>即將到來的活動</h2>
        
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--accent-primary)' }}>手動建立活動 (代替爬蟲)</h3>
          <form onSubmit={handleCreateEvent} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>活動名稱</label>
              <input type="text" value={newEventName} onChange={e => setNewEventName(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="電影/活動名稱" />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>開始時間</label>
              <input type="datetime-local" value={newEventStartTime} onChange={e => setNewEventStartTime(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} />
            </div>
            <div style={{ flex: '1 1 200px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>結束/解鎖時間</label>
              <input type="datetime-local" value={newEventUnlockTime} onChange={e => setNewEventUnlockTime(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} />
            </div>
            <button type="submit" style={{ flex: '0 0 auto', padding: '0.6rem 1.5rem', background: 'var(--accent-primary)', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', height: '39px' }}>
              建立
            </button>
          </form>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {events.length === 0 ? (
            <div className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>
              目前沒有任何進行中的活動。
            </div>
          ) : (
            events.map((event) => (
              <div key={event.id} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '1.2rem', color: '#fff', marginBottom: '0.5rem' }}>{event.name}</div>
                  <div className="text-muted" style={{ fontSize: '0.9rem' }}>開始： {new Date(event.startTime).toLocaleString()}</div>
                  <div className="text-muted" style={{ fontSize: '0.9rem' }}>結束： {new Date(event.unlockTime).toLocaleString()}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleDeleteEvent(event.id)} style={{ background: 'rgba(255, 60, 60, 0.2)', border: '1px solid #ff3c3c', color: '#ff3c3c', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    刪除
                  </button>
                  <button onClick={() => handleStartKiosk(event.id, event.venueId)} style={{ background: 'rgba(0, 163, 255, 0.2)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    啟動數位看板
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Dynamic Ads Management */}
      <div className="glass-panel" style={{ padding: '2rem', marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'white' }}>動態廣告管理</h2>
        <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          上傳場館專屬的動態廣告。廣告將會在使用者的解鎖頁面中，每 10 秒與平台全域廣告輪播一次。支援格式：JPG, PNG, WEBP, GIF (最大 5MB)。
        </p>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Upload Form */}
          <div style={{ flex: '1 1 300px', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--accent-primary)' }}>上傳新廣告</h3>
            <form onSubmit={handleUploadAd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>廣告標題</label>
                <input type="text" value={adTitle} onChange={e => setAdTitle(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="例如：超值爆米花套餐" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>廣告描述</label>
                <input type="text" value={adDescription} onChange={e => setAdDescription(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="非必填簡短描述" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>導購連結 (選填)</label>
                <input type="url" value={adLinkUrl} onChange={e => setAdLinkUrl(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="https://..." />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>圖片或動畫 (最大 5MB, 選填)</label>
                <input id="adFileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} />
              </div>
              <button type="submit" disabled={isUploading} style={{ marginTop: '0.5rem', padding: '0.8rem', background: 'var(--accent-primary)', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                {isUploading ? '上傳中...' : '上傳廣告'}
              </button>
            </form>
          </div>

          {/* Ad List */}
          <div style={{ flex: '2 1 400px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'white' }}>目前播放中的廣告</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {ads.length === 0 ? (
                <div className="text-muted" style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                  目前還沒有上傳任何廣告。
                </div>
              ) : (
                ads.map(ad => (
                  <div key={ad.id} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column' }}>
                    {ad.imageUrl && (
                      <div style={{ height: '120px', width: '100%', overflow: 'hidden' }}>
                        <img src={ad.imageUrl} alt={ad.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>{ad.title}</h4>
                      <p className="text-muted" style={{ fontSize: '0.8rem', marginBottom: '1rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                        {ad.description || '無描述'}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {ad.linkUrl ? (
                          <a href={ad.linkUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>預覽連結</a>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#666' }}>無連結</span>
                        )}
                        <button onClick={() => handleDeleteAd(ad.id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>刪除</button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
