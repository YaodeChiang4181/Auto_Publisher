import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ExternalLink, MessageCircle, Globe, MessagesSquare, Loader2, LockKeyhole, Star } from 'lucide-react';

const UnlockPage = () => {
  const navigate = useNavigate();
  const { eventId: urlEventId } = useParams();
  const eventId = urlEventId || localStorage.getItem('eventId');

  useEffect(() => {
    if (urlEventId) {
      localStorage.setItem('eventId', urlEventId);
    }
  }, [urlEventId]);
  
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [content, setContent] = useState<{
    trending: any[],
    ads: { central: any[], venue: any[] },
    officialReview?: any
  } | null>(null);
  
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isCentralAd, setIsCentralAd] = useState(true);

  const trackAction = async (actionType: string) => {
    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, actionType })
      });
    } catch (e) {
      console.error('Tracking failed', e);
    }
  };

  useEffect(() => {
    if (!eventId) {
      setErrorStatus(401);
      setLoading(false);
      return;
    }

    const fetchContent = async () => {
      try {
        const headers: HeadersInit = {};
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('t');
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(`/api/unlock/content/${eventId}`, { headers });
        if (!res.ok) {
          setErrorStatus(res.status);
          return;
        }
        
        const data = await res.json();
        setContent(data);
        
        // [Bugfix] 如果平台廣告為空，但場館廣告有內容，則預設直接顯示場館廣告，避免前 10 秒版面空白
        if (data.ads?.central?.length === 0 && data.ads?.venue?.length > 0) {
          setIsCentralAd(false);
        }
      } catch (e) {
        console.error('Failed to fetch unlock content', e);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [eventId, navigate]);

  // Ad rotation logic (every 10 seconds switch between central and venue ads)
  useEffect(() => {
    if (!content) return;
    
    const interval = setInterval(() => {
      setIsCentralAd(prev => {
        const willBeCentral = !prev;
        const adArray = willBeCentral ? content.ads.central : content.ads.venue;
        
        // If the next category has no ads, stay on current category and rotate its index instead
        if (!adArray || adArray.length === 0) {
          const currentArray = prev ? content.ads.central : content.ads.venue;
          if (currentArray && currentArray.length > 0) {
             setCurrentAdIndex(idx => (idx + 1) % currentArray.length);
          }
          return prev; 
        }
        
        // Switch category and reset index
        setCurrentAdIndex(0);
        return willBeCentral;
      });
    }, 10000);

    return () => clearInterval(interval);
  }, [content]);

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'IG': return <MessageCircle size={28} color="#E1306C" />;
      case 'FB': return <Globe size={28} color="#1877F2" />;
      case 'Dcard': return <div style={{ background: '#006AA6', color: 'white', fontWeight: 'bold', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>D</div>;
      default: return <MessagesSquare size={28} color="var(--accent-secondary)" />;
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'IG': return '#E1306C';
      case 'FB': return '#1877F2';
      case 'Dcard': return '#006AA6';
      default: return 'var(--accent-secondary)';
    }
  };

  if (loading) {
    return (
      <div className="flex-center" style={{ flexDirection: 'column', height: '80vh' }}>
        <Loader2 size={48} color="var(--accent-primary)" style={{ animation: 'spin 1.5s linear infinite', marginBottom: '2rem' }} />
        <h2 style={{ color: 'white' }}>正在為您搜集全網最新深度解析...</h2>
      </div>
    );
  }

  if (errorStatus === 403) {
    return (
      <div className="flex-center" style={{ flexDirection: 'column', height: '80vh', textAlign: 'center', padding: '2rem' }}>
        <LockKeyhole size={64} color="#f87171" style={{ marginBottom: '1.5rem' }} />
        <h2 style={{ color: '#f87171', marginBottom: '1rem' }}>活動尚未結束</h2>
        <p className="text-muted" style={{ marginBottom: '2rem' }}>
          基於防暴雷機制，彩蛋內容目前被時間鎖保護中。
        </p>
        <button 
          className="btn-primary"
          onClick={() => navigate('/wait', { replace: true })}
        >
          返回候車室
        </button>
      </div>
    );
  }

  if (errorStatus === 401 || errorStatus === 404) {
    return (
      <div className="flex-center" style={{ flexDirection: 'column', height: '80vh', textAlign: 'center', padding: '2rem' }}>
        <LockKeyhole size={64} color="#f87171" style={{ marginBottom: '1.5rem' }} />
        <h2 style={{ color: '#f87171', marginBottom: '1rem' }}>連結已失效或過期</h2>
        <p className="text-muted" style={{ marginBottom: '2rem' }}>
          此連結可能已經過期或不正確，請重新掃描現場 QRCode 參與活動。
        </p>
      </div>
    );
  }

  // Determine which ad to show
  const currentAdArray = isCentralAd ? content?.ads.central : content?.ads.venue;
  const currentAd = currentAdArray && currentAdArray.length > 0 ? currentAdArray[currentAdIndex] : null;

  return (
    <div style={{ animation: 'fade-in 0.8s ease-out', maxWidth: '800px', margin: '0 auto', paddingBottom: '4rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className="title-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
          解鎖成功
        </h1>
        <p className="text-muted">為您精選網路前三名熱門解析與無雷心得</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '3rem' }}>
        {content?.boundCharacter && (
          <div
            className="glass-panel"
            style={{
              padding: '1.5rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '1.5rem',
              borderLeft: `4px solid #10b981`,
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div style={{ position: 'absolute', top: 0, right: 0, padding: '0.25rem 0.75rem', background: '#10b981', color: '#000', fontSize: '0.8rem', fontWeight: 'bold', borderBottomLeftRadius: '8px' }}>
              專屬結局解鎖
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1rem', borderRadius: '12px', flexShrink: 0 }}>
              <LockKeyhole size={28} color="#10b981" />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1.2rem', color: '#10b981', lineHeight: 1.4 }}>
                角色：{content.boundCharacter.name}
              </h3>
              {content.boundCharacter.textEnding && (
                <p style={{ color: '#fff', fontSize: '1rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>
                  {content.boundCharacter.textEnding}
                </p>
              )}
              {content.boundCharacter.fileUrl && (
                <a
                  href={content.boundCharacter.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary"
                  style={{ display: 'inline-block', background: '#10b981', color: '#000', padding: '0.5rem 1rem', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '0.9rem' }}
                >
                  下載專屬檔案
                </a>
              )}
            </div>
          </div>
        )}

        {content?.trending && content.trending.length > 0 ? (
          <>
            {(content.officialReview ? content.trending.slice(0, 2) : content.trending.slice(0, 3)).map((item, idx) => (
              <a 
                key={idx}
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="glass-panel" 
                style={{ 
                  padding: '1.5rem', 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '1.5rem', 
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'transform 0.3s, box-shadow 0.3s', 
                  borderLeft: `4px solid ${getPlatformColor(item.platform)}` 
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateX(8px)';
                  e.currentTarget.style.boxShadow = `0 4px 20px ${getPlatformColor(item.platform)}40`;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '12px', flexShrink: 0 }}>
                  {getPlatformIcon(item.platform)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem', color: '#fff', lineHeight: 1.4 }}>
                      {item.title}
                    </h3>
                    <ExternalLink size={16} color="var(--accent-primary)" style={{ flexShrink: 0, marginLeft: '0.5rem' }} />
                  </div>
                  <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {item.snippet}
                  </p>
                </div>
              </a>
            ))}

            {content.officialReview && (
              <a 
                href={content.officialReview.linkUrl || content.officialReview.imageUrl || '#'}
                target="_blank"
                rel="noreferrer"
                className="glass-panel" 
                style={{ 
                  padding: '1.5rem', 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '1.5rem', 
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'transform 0.3s, box-shadow 0.3s', 
                  borderLeft: `4px solid #facc15` 
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = 'translateX(8px)';
                  e.currentTarget.style.boxShadow = `0 4px 20px rgba(250, 204, 21, 0.4)`;
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ background: 'rgba(250, 204, 21, 0.1)', padding: '1rem', borderRadius: '12px', flexShrink: 0 }}>
                  <Star size={28} color="#facc15" fill="#facc15" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem', color: '#facc15', lineHeight: 1.4, fontWeight: 'bold' }}>
                      *{content.officialReview.title}*
                    </h3>
                    {(content.officialReview.linkUrl || content.officialReview.imageUrl) && <ExternalLink size={16} color="#facc15" style={{ flexShrink: 0, marginLeft: '0.5rem' }} />}
                  </div>
                  <p className="text-muted" style={{ fontSize: '0.9rem', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {content.officialReview.description}
                  </p>
                </div>
              </a>
            )}
            
            {/* Social Media Links for guiding posting */}
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <p className="text-muted" style={{ marginBottom: '1.5rem', fontSize: '1rem', color: 'var(--accent-primary)' }}>分享你的無雷心得，開啟 App 發文 👇</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem' }}>
                <a 
                  href="https://www.facebook.com/" 
                  target="_blank" 
                  rel="noreferrer"
                  onClick={() => trackAction('CLICK_SOCIAL_SHARE')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#1877F2',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(24, 119, 242, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(24, 119, 242, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-3px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
                  </svg>
                </a>
                <a 
                  href="https://www.instagram.com/" 
                  target="_blank" 
                  rel="noreferrer"
                  title="開啟 Instagram"
                  onClick={() => trackAction('CLICK_SOCIAL_SHARE')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#E1306C',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(225, 48, 108, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(225, 48, 108, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-3px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                  </svg>
                </a>
                <a 
                  href="https://www.threads.net/intent/post" 
                  target="_blank" 
                  rel="noreferrer"
                  title="開啟 Threads 發文"
                  onClick={() => trackAction('CLICK_SOCIAL_SHARE')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#ffffff',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    e.currentTarget.style.transform = 'translateY(-3px)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                    e.currentTarget.style.transform = 'none';
                  }}
                >
                  {/* Threads logo approximation with AtSign */}
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 12c0 1.5-1.5 2.5-2.5 2.5S9.5 13.5 9.5 12s1.5-2.5 2.5-2.5c1.5 0 2.5 1 2.5 2.5Z"></path>
                    <path d="M12 14.5c-3 0-5-2-5-5s2-5 5-5 5 2.5 5 5-2.5 5-5 5"></path>
                    <path d="M12 21.5c-5.5 0-9.5-4-9.5-9.5s4-9.5 9.5-9.5 9.5 4 9.5 9.5-2.5 8-5 8"></path>
                  </svg>
                </a>
              </div>
            </div>
          </>
        ) : (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <p className="text-muted">目前網路上尚未有足夠的熱門討論。</p>
          </div>
        )}
      </div>

      {/* Interactive Ad Block */}
      {currentAd && (
        currentAd.linkUrl ? (
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
            <div style={{ padding: '1.5rem', background: 'linear-gradient(to right, rgba(255,255,255,0.05), transparent)' }}>
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
              animation: 'fade-in 0.5s'
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
        )
      )}
      
      <style>{`
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default UnlockPage;
