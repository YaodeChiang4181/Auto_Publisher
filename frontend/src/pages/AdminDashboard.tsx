import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  
  // Venue state
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
        body: JSON.stringify({ geoLat, geoLng, geoRadius: radiusMeters })
      });
      alert('Venue location settings updated successfully!');
    } catch (e) {
      alert('Failed to update venue settings.');
    } finally {
      setIsUpdatingVenue(false);
    }
  };

  const handleGenerate2FA = async () => {
    try {
      const res = await fetch('/api/admin/2fa/generate', {
        method: 'POST'
      });
      const data = await res.json();
      if (data.qrCodeUrl) {
        setQrCodeUrl(data.qrCodeUrl);
        setSetup2FAMode(true);
      }
    } catch (e) {
      alert('Failed to generate 2FA QR Code');
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
      
      if (!res.ok) throw new Error();
      
      alert('2FA enabled successfully! Please login again with your new 24-hour token limit.');
      handleLogout();
    } catch (e) {
      alert('Invalid 2FA code');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit.');
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
      alert('Advertisement uploaded successfully!');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteAd = async (id: string) => {
    if (!confirm('Are you sure you want to delete this ad?')) return;
    try {
      const res = await fetch(`/api/admin/ads/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAds(ads.filter(ad => ad.id !== id));
      } else {
        alert('Failed to delete ad');
      }
    } catch (e) {
      alert('Error deleting ad');
    }
  };

  if (loading) {
    return <div className="glass-panel" style={{ textAlign: 'center', padding: '3rem', margin: '2rem auto', maxWidth: '400px' }}>Loading...</div>;
  }

  return (
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="title-gradient" style={{ fontSize: '2rem', margin: 0 }}>AutoPublisher B2B</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="text-muted">Welcome, {user?.name || user?.username}</span>
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
            Logout
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
        {/* Venue Location Settings */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'white' }}>📍 Venue Geo-fencing</h2>
          <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Set the geographical boundaries for this venue. Users scanning QR codes outside this radius will be marked as unverified.
          </p>
          <form onSubmit={handleUpdateVenue} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Latitude</label>
                <input type="text" value={geoLat} onChange={e => setGeoLat(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Longitude</label>
                <input type="text" value={geoLng} onChange={e => setGeoLng(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Radius (Kilometers)</label>
              <input type="number" step="0.1" value={geoRadiusKm} onChange={e => setGeoRadiusKm(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} />
            </div>
            <button type="submit" disabled={isUpdatingVenue} style={{ marginTop: '0.5rem', padding: '0.6rem', background: 'var(--accent-secondary)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              {isUpdatingVenue ? 'Updating...' : 'Save Location Settings'}
            </button>
          </form>
        </div>

        {/* Security Settings */}
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'white' }}>🔐 Security Settings</h2>
          
          <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong style={{ display: 'block', marginBottom: '0.3rem' }}>Two-Factor Authentication (2FA)</strong>
                <span className="text-muted" style={{ fontSize: '0.85rem' }}>Requires a 6-digit code every 24 hours.</span>
              </div>
              <div>
                {is2FAEnabled ? (
                  <span style={{ color: '#4ade80', fontWeight: 'bold' }}>✓ Enabled</span>
                ) : (
                  <button onClick={handleGenerate2FA} style={{ padding: '0.4rem 0.8rem', background: 'transparent', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', borderRadius: '4px', cursor: 'pointer' }}>
                    Enable 2FA
                  </button>
                )}
              </div>
            </div>
            
            {setup2FAMode && !is2FAEnabled && (
              <div style={{ marginTop: '1.5rem', textAlign: 'center', padding: '1rem', background: 'white', borderRadius: '8px' }}>
                <img src={qrCodeUrl} alt="2FA QR Code" style={{ width: '150px', height: '150px', marginBottom: '1rem' }} />
                <p style={{ color: 'black', fontSize: '0.9rem', marginBottom: '1rem' }}>Scan with Google Authenticator</p>
                <form onSubmit={handleEnable2FA} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" maxLength={6} required value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value)} placeholder="000000" style={{ flex: 1, padding: '0.5rem', textAlign: 'center', letterSpacing: '0.2rem', border: '1px solid #ccc', borderRadius: '4px', color: 'black' }} />
                  <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--accent-primary)', color: 'black', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Verify</button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: 'white' }}>Upcoming Events</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {events.length === 0 ? (
            <div className="text-muted" style={{ textAlign: 'center', padding: '2rem' }}>
              No active events found for your venue.
            </div>
          ) : (
            events.map((event) => (
              <div key={event.id} style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '12px', padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '1.2rem', color: '#fff', marginBottom: '0.5rem' }}>{event.name}</div>
                  <div className="text-muted" style={{ fontSize: '0.9rem' }}>Starts: {new Date(event.startTime).toLocaleString()}</div>
                </div>
                <div>
                  <button onClick={() => handleStartKiosk(event.id, event.venueId)} style={{ background: 'rgba(0, 163, 255, 0.2)', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    Start Kiosk
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Dynamic Ads Management */}
      <div className="glass-panel" style={{ padding: '2rem', marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: 'white' }}>🖼️ Dynamic Ads Management</h2>
        <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: '1.5rem' }}>
          Upload your venue-specific advertisements. These will be rotated every 10 seconds alongside central ads on the user's unlock page. Supported formats: JPG, PNG, WEBP, GIF (Max 5MB).
        </p>

        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {/* Upload Form */}
          <div style={{ flex: '1 1 300px', background: 'rgba(255,255,255,0.02)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--accent-primary)' }}>Upload New Ad</h3>
            <form onSubmit={handleUploadAd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Ad Title</label>
                <input type="text" value={adTitle} onChange={e => setAdTitle(e.target.value)} required style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="E.g., Special Popcorn Combo" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Description</label>
                <input type="text" value={adDescription} onChange={e => setAdDescription(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="Optional short description" />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Link URL (Optional)</label>
                <input type="url" value={adLinkUrl} onChange={e => setAdLinkUrl(e.target.value)} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} placeholder="https://..." />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Image / Animation (Max 5MB, Optional)</label>
                <input id="adFileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileChange} style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }} />
              </div>
              <button type="submit" disabled={isUploading} style={{ marginTop: '0.5rem', padding: '0.8rem', background: 'var(--accent-primary)', color: 'black', fontWeight: 'bold', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                {isUploading ? 'Uploading...' : 'Upload Advertisement'}
              </button>
            </form>
          </div>

          {/* Ad List */}
          <div style={{ flex: '2 1 400px' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'white' }}>Current Active Ads</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {ads.length === 0 ? (
                <div className="text-muted" style={{ padding: '2rem', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                  No advertisements uploaded yet.
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
                        {ad.description || 'No description'}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {ad.linkUrl ? (
                          <a href={ad.linkUrl} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: 'var(--accent-primary)' }}>Preview Link</a>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#666' }}>No Link</span>
                        )}
                        <button onClick={() => handleDeleteAd(ad.id)} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.3rem 0.6rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}>Delete</button>
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
