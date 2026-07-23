import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Instagram, Facebook, MessagesSquare, Loader2 } from 'lucide-react';

const UnlockPage = () => {
  const navigate = useNavigate();
  const sessionToken = localStorage.getItem('sessionToken');
  const eventId = localStorage.getItem('eventId');
  
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<{
    trending: any[],
    ads: { central: any[], venue: any[] }
  } | null>(null);
  
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [isCentralAd, setIsCentralAd] = useState(true);

  useEffect(() => {
    if (!sessionToken || !eventId) {
      navigate('/', { replace: true });
      return;
    }

    const fetchContent = async () => {
      try {
        const res = await fetch(`/api/unlock/content/${eventId}`);
        if (res.ok) {
          const data = await res.json();
          setContent(data);
        }
      } catch (e) {
        console.error('Failed to fetch unlock content', e);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [sessionToken, eventId, navigate]);

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
      case 'IG': return <Instagram size={28} color="#E1306C" />;
      case 'FB': return <Facebook size={28} color="#1877F2" />;
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
        {content?.trending && content.trending.length > 0 ? (
          content.trending.map((item, idx) => (
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
          ))
        ) : (
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
            <p className="text-muted">目前網路上尚未有足夠的熱門討論。</p>
          </div>
        )}
      </div>

      {/* Interactive Ad Block */}
      {currentAd && (
        <a 
          href={currentAd.linkUrl}
          target="_blank"
          rel="noreferrer"
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
