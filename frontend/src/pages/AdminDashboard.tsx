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
  const [adType, setAdType] = useState('VENUE');
  const [adFile, setAdFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Manual event state
  const [newEventName, setNewEventName] = useState('');
  const [newEventStartTime, setNewEventStartTime] = useState('');
  const [newEventDuration, setNewEventDuration] = useState('');

  // 2FA state
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [setup2FAMode, setSetup2FAMode] = useState(false);

  // Push Content state
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [pcTitle, setPcTitle] = useState('');
  const [pcMerchLink, setPcMerchLink] = useState('');
  const [pcCouponCode, setPcCouponCode] = useState('');
  const [pcFile, setPcFile] = useState<File | null>(null);
  const [isUploadingPc, setIsUploadingPc] = useState(false);

  // Character state
  const [charName, setCharName] = useState('');
  const [charTextEnding, setCharTextEnding] = useState('');
  const [charFile, setCharFile] = useState<File | null>(null);
  const [isUploadingChar, setIsUploadingChar] = useState(false);

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

        if (!meRes.ok || !eventsRes.ok || !adsRes.ok) {
          throw new Error('API request failed');
        }

        const meData = await meRes.json();
        const eventsData = await eventsRes.json();
        const adsData = await adsRes.json();

        setUser(meData.user || null);
        setEvents(Array.isArray(eventsData) ? eventsData : []);
        setAds(Array.isArray(adsData) ? adsData : []);
        if (meData.user) {
          setIs2FAEnabled(meData.user.isTwoFactorEnabled);
          if (meData.user.venue) {
            setVenueName(meData.user.venue.name || meData.user.username || '');
            setGeoLat(meData.user.venue.geoLat.toString());
            setGeoLng(meData.user.venue.geoLng.toString());
            setGeoRadiusKm((meData.user.venue.geoRadius / 1000).toString());
          }
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
      const startTimeDate = new Date(newEventStartTime);
      const durationMins = parseInt(newEventDuration, 10) || 0;
      const unlockTimeDate = new Date(startTimeDate.getTime() + durationMins * 60000);

      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newEventName, 
          startTime: startTimeDate.toISOString(), 
          unlockTime: unlockTimeDate.toISOString() 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create event');
      setEvents([...events, data].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
      setNewEventName('');
      setNewEventStartTime('');
      setNewEventDuration('');
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

  const fetchEventsHelper = async () => {
    try {
      const res = await fetch('/api/admin/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateAttendance = async (eventId: string, attendance: string) => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}/attendance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalAttendance: attendance })
      });
      if (res.ok) {
        fetchEventsHelper();
        alert('人數已更新');
      } else {
        const error = await res.json();
        alert(error.error || '更新失敗');
      }
    } catch (e) {
      console.error(e);
      alert('網路錯誤');
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
      formData.append('type', adType);
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

  const handlePcFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 15 * 1024 * 1024) {
        alert('檔案大小超過 15MB 限制。');
        e.target.value = '';
        return;
      }
      setPcFile(file);
    }
  };

  const handleUploadPushContent = async (e: React.FormEvent, eventId: string) => {
    e.preventDefault();
    if (!pcFile && !pcMerchLink) {
      alert('請至少提供「檔案」或「外部連結」。');
      return;
    }
    setIsUploadingPc(true);
    try {
      const formData = new FormData();
      formData.append('title', pcTitle);
      formData.append('merchLink', pcMerchLink);
      formData.append('couponCode', pcCouponCode);
      if (pcFile) {
        formData.append('file', pcFile);
      }

      const res = await fetch(`/api/admin/events/${eventId}/push-contents`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      
      setEvents(events.map(ev => {
        if (ev.id === eventId) {
          return { ...ev, pushContents: [...(ev.pushContents || []), data] };
        }
        return ev;
      }));

      setPcTitle('');
      setPcMerchLink('');
      setPcCouponCode('');
      setPcFile(null);
      const fileInput = document.getElementById(`pcFileInput-${eventId}`) as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      alert('推播內容上傳成功！');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsUploadingPc(false);
    }
  };

  const handleDeletePushContent = async (eventId: string, pcId: string) => {
    if (!confirm('確定要刪除這筆推播內容嗎？')) return;
    try {
      const res = await fetch(`/api/admin/push-contents/${pcId}`, { method: 'DELETE' });
      if (res.ok) {
        setEvents(events.map(ev => {
          if (ev.id === eventId) {
            return { ...ev, pushContents: (ev.pushContents || []).filter((pc: any) => pc.id !== pcId) };
          }
          return ev;
        }));
      } else {
        const error = await res.json();
        alert(error.error || '刪除失敗');
      }
    } catch (e) {
      alert('刪除時發生錯誤');
    }
  };

  const handleCharFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert('檔案大小超過 5MB 限制。');
        e.target.value = '';
        return;
      }
      setCharFile(file);
    }
  };

  const handleCreateChar = async (e: React.FormEvent, eventId: string) => {
    e.preventDefault();
    setIsUploadingChar(true);
    try {
      const formData = new FormData();
      formData.append('name', charName);
      formData.append('bindingCode', charName); // 使用角色名稱作為綁定代碼
      formData.append('textEnding', charTextEnding);
      if (charFile) formData.append('file', charFile);

      const res = await fetch(`/api/admin/events/${eventId}/characters`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      
      setEvents(events.map(ev => {
        if (ev.id === eventId) {
          return { ...ev, characters: [...(ev.characters || []), data] };
        }
        return ev;
      }));

      setCharName('');
      setCharTextEnding('');
      setCharFile(null);
      const fileInput = document.getElementById(`charFileInput-${eventId}`) as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      alert('角色新增成功！');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsUploadingChar(false);
    }
  };

  const handleDeleteChar = async (eventId: string, charId: string) => {
    if (!confirm('確定要刪除這個角色嗎？')) return;
    try {
      const res = await fetch(`/api/admin/characters/${charId}`, { method: 'DELETE' });
      if (res.ok) {
        setEvents(events.map(ev => {
          if (ev.id === eventId) {
            return { ...ev, characters: (ev.characters || []).filter((c: any) => c.id !== charId) };
          }
          return ev;
        }));
      } else {
        alert('刪除失敗');
      }
    } catch (e) {
      alert('刪除時發生錯誤');
    }
  };

  const handleCopyGMLink = (token: string) => {
    const url = `${window.location.origin}/gm/${token}`;
    navigator.clipboard.writeText(url)
      .then(() => alert('GM 控制台連結已複製！\n請將此連結傳給 GM 手機開啟，進行時間控制與接收防呆預警。'))
      .catch(() => alert('複製失敗，請手動複製: ' + url));
  };

  if (loading) {
    return <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', margin: '2rem auto', maxWidth: '400px' }}>載入中...</div>;
  }

  return (
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <h1 className="title-gradient" style={{ fontSize: '2rem', margin: 0 }}>AutoPublisher B2B</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginBottom: '2rem' }}>
        {/* Venue Location Settings */}
        <div className="glass-panel" style={{ flex: '1 1 300px', width: '100%', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'white' }}>場域地理圍欄設定</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            設定此場館的地理邊界，以及場館顯示名稱。在半徑外掃描 QR Code 的使用者將會被標記為未驗證狀態。
          </p>
          <form onSubmit={handleUpdateVenue} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>場館名稱 (顯示在 Kiosk 數位看板)</label>
              <input type="text" value={venueName} onChange={e => setVenueName(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="例如：信義威秀影城" />
            </div>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
        <div className="glass-panel" style={{ flex: '1 1 300px', width: '100%', padding: '2rem' }}>
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
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>活動時長 (分鐘)</label>
              <input type="number" min="1" value={newEventDuration} onChange={e => setNewEventDuration(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="例如：120" />
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
              <div key={event.id} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ textAlign: 'left', flex: '1 1 200px' }}>
                    <div style={{ fontWeight: 600, fontSize: '1.2rem', color: '#fff', marginBottom: '0.5rem' }}>{event.name}</div>
                    <div className="text-muted" style={{ fontSize: '0.9rem' }}>開始： {new Date(event.startTime).toLocaleString()}</div>
                    <div className="text-muted" style={{ fontSize: '0.9rem' }}>結束： {new Date(event.unlockTime).toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%', justifyContent: 'flex-start' }}>
                    <button onClick={() => handleDeleteEvent(event.id)} style={{ flex: '1 1 80px', minWidth: '80px', background: 'rgba(255, 60, 60, 0.2)', border: '1px solid #ff3c3c', color: '#ff3c3c', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'center' }}>
                      刪除
                    </button>
                    <button onClick={() => handleStartKiosk(event.id, event.venueId)} style={{ flex: '1 1 120px', minWidth: '120px', background: 'rgba(0, 163, 255, 0.2)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'center' }}>
                      啟動數位看板
                    </button>
                    {event.gmControlToken && (
                      <button 
                        onClick={() => handleCopyGMLink(event.gmControlToken)} 
                        style={{ flex: '1 1 120px', minWidth: '120px', background: 'rgba(250, 204, 21, 0.2)', border: '1px solid #facc15', color: '#facc15', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'center' }}
                      >
                        複製 GM 連結
                      </button>
                    )}
                    <button 
                      onClick={() => setExpandedEventId(expandedEventId === event.id ? null : event.id)} 
                      style={{ flex: '1 1 150px', minWidth: '120px', background: 'var(--accent-primary)', border: 'none', color: 'black', padding: '0.8rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap', textAlign: 'center' }}
                    >
                      {expandedEventId === event.id ? '收起推播設定' : '推播卡片管理'}
                    </button>
                  </div>
                </div>

                {expandedEventId === event.id && (
                  <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <h4 style={{ color: 'var(--accent-primary)', marginBottom: '1rem', fontSize: '1.1rem' }}>管理專屬推播卡片 ({event.pushContents?.length || 0}/3)</h4>
                    <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                      最多可設定 3 張卡片，不足的卡片將由系統自動抓取「全網熱議爬蟲」補齊。
                      (最多允許上傳 2 個直接檔案，其餘請使用外部連結)
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                      {(event.pushContents || []).map((pc: any, idx: number) => (
                        <div key={pc.id} style={{ flex: '1 1 250px', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                          <div style={{ position: 'absolute', top: 5, left: 5, background: 'rgba(250, 204, 21, 0.9)', color: 'black', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                            卡片 {idx + 1}
                          </div>
                          <div style={{ marginTop: '1.5rem' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1rem', marginBottom: '0.5rem', color: 'white' }}>{pc.title}</div>
                            {pc.couponCode && <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginBottom: '0.2rem' }}>優惠碼: {pc.couponCode}</div>}
                            {pc.merchLink && <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>連結: {pc.merchLink}</div>}
                            {pc.contentUrl && <div style={{ fontSize: '0.8rem', color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>媒體: 已上傳</div>}
                          </div>
                          <button onClick={() => handleDeletePushContent(event.id, pc.id)} style={{ position: 'absolute', top: 5, right: 5, background: '#ef4444', color: 'white', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>刪除</button>
                        </div>
                      ))}
                    </div>

                    {(event.pushContents?.length || 0) < 3 && (
                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.2)' }}>
                        <h5 style={{ fontSize: '1rem', marginBottom: '1rem' }}>新增卡片</h5>
                        <form onSubmit={(e) => handleUploadPushContent(e, event.id)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>推播標題 (必填)</label>
                            <input type="text" value={pcTitle} onChange={e => setPcTitle(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="例如：領取獨家優惠" />
                          </div>
                          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 200px' }}>
                              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>外部連結 (選填)</label>
                              <input type="url" value={pcMerchLink} onChange={e => setPcMerchLink(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="https://..." />
                            </div>
                            <div style={{ flex: '1 1 200px' }}>
                              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>按鈕上的優惠碼文字 (選填)</label>
                              <input type="text" value={pcCouponCode} onChange={e => setPcCouponCode(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="例如：VIP888" />
                            </div>
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>檔案上傳 (選填, 最大 15MB, JPG/PNG/GIF/PDF)</label>
                            <input id={`pcFileInput-${event.id}`} type="file" accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" onChange={handlePcFileChange} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} />
                          </div>
                          <button type="submit" disabled={isUploadingPc} style={{ padding: '0.6rem', background: 'var(--accent-primary)', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', alignSelf: 'flex-start' }}>
                            {isUploadingPc ? '上傳中...' : '確認新增'}
                          </button>
                        </form>
                      </div>
                    )}

                    {/* 管理角色與專屬文本區塊 */}
                    <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <h4 style={{ color: '#4ade80', marginBottom: '1rem', fontSize: '1.1rem' }}>管理角色與專屬結局</h4>
                      <p className="text-muted" style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
                        建立角色並設定專屬「綁定代碼」(User ID)。玩家在 LINE 聊天室輸入該代碼即可綁定。解鎖時會推播該角色的專屬結局。
                      </p>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
                        {(event.characters || []).map((char: any) => (
                          <div key={char.id} style={{ flex: '1 1 250px', background: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#4ade80', marginBottom: '0.5rem' }}>{char.name}</div>
                            <div style={{ fontSize: '0.85rem', color: '#ccc', marginBottom: '0.2rem' }}>代碼: <span style={{ color: 'white' }}>{char.bindingCode}</span></div>
                            <div style={{ fontSize: '0.85rem', color: '#ccc', marginBottom: '0.2rem' }}>已綁定: {char.boundLineId ? '✅ 是' : '❌ 否'}</div>
                            {char.textEnding && <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem', maxHeight: '40px', overflow: 'hidden', textOverflow: 'ellipsis' }}>結局: {char.textEnding}</div>}
                            {char.fileUrl && <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>附檔: {char.fileUrl}</div>}
                            <button onClick={() => handleDeleteChar(event.id, char.id)} style={{ position: 'absolute', top: 5, right: 5, background: '#ef4444', color: 'white', border: 'none', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>刪除</button>
                          </div>
                        ))}
                      </div>

                      <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px dashed rgba(74,222,128,0.3)' }}>
                        <h5 style={{ fontSize: '1rem', marginBottom: '1rem', color: '#4ade80' }}>新增角色</h5>
                        <form onSubmit={(e) => handleCreateChar(e, event.id)} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <div style={{ flex: '1 1 200px' }}>
                              <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>角色名稱 (即玩家輸入的綁定代碼)</label>
                              <input type="text" value={charName} onChange={e => setCharName(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="例如：警察" />
                            </div>
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>文字結局 (選填)</label>
                            <textarea value={charTextEnding} onChange={e => setCharTextEnding(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px', minHeight: '60px' }} placeholder="給這個角色的專屬文字訊息" />
                          </div>
                          <div>
                            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem' }}>檔案上傳 (選填, 最大 5MB, TXT/PDF/圖)</label>
                            <input id={`charFileInput-${event.id}`} type="file" accept="text/plain,application/pdf,image/jpeg,image/png" onChange={handleCharFileChange} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} />
                          </div>
                          <button type="submit" disabled={isUploadingChar} style={{ padding: '0.6rem', background: '#4ade80', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer', alignSelf: 'flex-start' }}>
                            {isUploadingChar ? '處理中...' : '確認新增角色'}
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', marginTop: '2rem' }}>
        {/* Statistics Panel */}
        <div className="glass-panel" style={{ flex: '1 1 300px', width: '100%', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'white' }}>活動數據統計</h2>
          {events.length === 0 ? (
            <p className="text-muted">目前沒有活動</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {events.map((event) => (
                <div key={event.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <h3 style={{ fontSize: '1.1rem', color: 'var(--accent-primary)', marginBottom: '1rem' }}>{event.name}</h3>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.9rem' }}>現場總人數:</span>
                    <input 
                      type="number" 
                      defaultValue={event.stats?.totalAttendance || ''}
                      onBlur={(e) => {
                        if(e.target.value) handleUpdateAttendance(event.id, e.target.value);
                      }}
                      style={{ width: '100px', padding: '0.3rem', background: 'rgba(0,0,0,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px' }}
                      placeholder="未輸入"
                    />
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>掃碼率</div>
                      <div style={{ fontWeight: 'bold' }}>{event.stats?.scanRate !== null && event.stats?.scanRate !== undefined ? `${event.stats.scanRate.toFixed(1)}%` : '-'}</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>散場互動率 (15分內)</div>
                      <div style={{ fontWeight: 'bold' }}>{event.stats?.interactionRate?.toFixed(1) || 0}%</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>廣告點擊率</div>
                      <div style={{ fontWeight: 'bold' }}>{event.stats?.ctr?.toFixed(1) || 0}%</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '4px' }}>
                      <div className="text-muted" style={{ fontSize: '0.8rem' }}>總掃描數</div>
                      <div style={{ fontWeight: 'bold' }}>{event.stats?.totalScans || 0}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Ads Management */}
        <div className="glass-panel" style={{ flex: '1 1 300px', width: '100%', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'white' }}>動態廣告管理</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            上傳場館專屬的動態廣告。廣告將會在使用者的解鎖頁面中，每 10 秒與平台全域廣告輪播一次。支援格式：JPG, PNG, WEBP, GIF (最大 5MB)。
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            {/* Upload Form */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--accent-primary)' }}>上傳新廣告</h3>
              <form onSubmit={handleUploadAd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>廣告類型</label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="radio" name="adType" value="VENUE" checked={adType === 'VENUE'} onChange={() => setAdType('VENUE')} />
                      一般視覺廣告
                    </label>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <input type="radio" name="adType" value="OFFICIAL_REVIEW" checked={adType === 'OFFICIAL_REVIEW'} onChange={() => setAdType('OFFICIAL_REVIEW')} />
                      官方深度解析
                    </label>
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{adType === 'OFFICIAL_REVIEW' ? '解析標題' : '廣告標題'}</label>
                  <input type="text" value={adTitle} onChange={e => setAdTitle(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder={adType === 'OFFICIAL_REVIEW' ? "例如：導演親自解析：結尾的三個隱喻" : "例如：超值爆米花套餐"} />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{adType === 'OFFICIAL_REVIEW' ? '解析描述' : '廣告描述'}</label>
                  <input type="text" value={adDescription} onChange={e => setAdDescription(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="非必填簡短描述" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{adType === 'OFFICIAL_REVIEW' ? '解析連結 (選填)' : '導購連結 (選填)'}</label>
                  <input type="url" value={adLinkUrl} onChange={e => setAdLinkUrl(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="https://..." />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{adType === 'OFFICIAL_REVIEW' ? 'PDF檔案 (最大 15MB, 選填)' : '圖片或動畫 (最大 5MB, 選填)'}</label>
                  <input id="adFileInput" type="file" accept={adType === 'OFFICIAL_REVIEW' ? 'application/pdf' : 'image/jpeg,image/png,image/webp,image/gif'} onChange={handleFileChange} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} />
                  <div style={{ fontSize: '0.8rem', color: '#ffcc00', marginTop: '0.5rem' }}>
                    {adType === 'OFFICIAL_REVIEW' ? '⚠️ 請上傳清晰的 PDF 檔案，供使用者下載或閱讀。' : '⚠️ 請注意展覽尺寸建議比例為（16：9）或橫幅長條圖（高度 160px），以確保最佳展示效果。'}
                  </div>
                  {adFile && (
                    <div style={{ marginTop: '1rem', border: '1px dashed rgba(255,255,255,0.3)', padding: '0.5rem', borderRadius: '8px', textAlign: 'center' }}>
                      <p style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginBottom: '0.5rem' }}>上傳前預覽 (直接讀取本地檔案，未使用 Base64)</p>
                      {adFile.type === 'application/pdf' ? (
                        <p style={{ fontSize: '0.9rem' }}>📄 {adFile.name}</p>
                      ) : (
                        <img src={URL.createObjectURL(adFile)} alt="預覽" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '4px', objectFit: 'contain' }} />
                      )}
                    </div>
                  )}
                </div>
                <button type="submit" disabled={isUploading} style={{ marginTop: '0.5rem', padding: '0.8rem', background: 'var(--accent-primary)', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  {isUploading ? '上傳中...' : '上傳廣告'}
                </button>
              </form>
            </div>

            {/* Ad List */}
            <div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'white' }}>目前播放中的廣告</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                {ads.length === 0 ? (
                  <div className="text-muted" style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                    目前還沒有上傳任何廣告。
                  </div>
                ) : (
                  ads.map(ad => (
                    <div key={ad.id} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 5, left: 5, background: ad.type === 'OFFICIAL_REVIEW' ? 'rgba(250, 204, 21, 0.9)' : 'rgba(0, 163, 255, 0.9)', color: 'black', fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', zIndex: 10, fontWeight: 'bold' }}>
                        {ad.type === 'OFFICIAL_REVIEW' ? '官方解析' : '視覺廣告'}
                      </div>
                      {ad.imageUrl && (
                        <div style={{ height: '120px', width: '100%', overflow: 'hidden' }}>
                          <img src={ad.imageUrl} alt={ad.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      )}
                      <div style={{ padding: '1rem', flex: 1, display: 'flex', flexDirection: 'column', paddingTop: ad.imageUrl ? '1rem' : '2rem' }}>
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
    </div>
  );
};

export default AdminDashboard;
