import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, XCircle, Loader2 } from 'lucide-react';

const ScanPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error' | 'location'>('location');
  const [errMsg, setErr] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setErr('無效的 QR Code (Missing Token)');
      return;
    }

    const verifyToken = async (geoLat?: number, geoLng?: number) => {
      setStatus('verifying');
      try {
        let url = `/api/qr/scan?token=${token}`;
        if (geoLat !== undefined && geoLng !== undefined) {
          url += `&geoLat=${geoLat}&geoLng=${geoLng}`;
        }

        const res = await fetch(url);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || '驗證失敗');
        }

        // Store eventId in localStorage, sessionToken is now in HttpOnly Cookie
        localStorage.setItem('eventId', data.eventId);

        setStatus('success');
        
        // Short delay to show success animation before redirecting
        setTimeout(() => {
          navigate('/wait', { replace: true });
        }, 1500);

      } catch (err: any) {
        setStatus('error');
        setErr(err.message || '網路錯誤');
      }
    };

    // Request Geolocation
    if ('geolocation' in navigator) {
      // Setup a timeout so we don't wait forever if the browser location API hangs
      let locationResolved = false;
      
      const geoTimeout = setTimeout(() => {
        if (!locationResolved) {
          locationResolved = true;
          verifyToken(); // Fallback without geo
        }
      }, 5000); // 5 second timeout

      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (!locationResolved) {
            locationResolved = true;
            clearTimeout(geoTimeout);
            verifyToken(position.coords.latitude, position.coords.longitude);
          }
        },
        (error) => {
          if (!locationResolved) {
            locationResolved = true;
            clearTimeout(geoTimeout);
            console.warn('Geolocation error or denied:', error.message);
            verifyToken(); // Fallback without geo
          }
        },
        { timeout: 4000, maximumAge: 60000 }
      );
    } else {
      verifyToken(); // Browser doesn't support geolocation
    }

  }, [searchParams, navigate]);

  return (
    <div className="glass-panel flex-center" style={{ minHeight: '300px', flexDirection: 'column' }}>
      {status === 'location' && (
        <>
          <Loader2 size={64} color="var(--accent-primary)" style={{ animation: 'spin 1.5s linear infinite' }} />
          <h2 style={{ marginTop: '1.5rem' }}>正在取得定位權限...</h2>
          <p className="text-muted" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
            為了提供專屬場館互動體驗，請允許存取您的位置。<br/>
            (若您拒絕，仍可進入，但可能無法參與限定活動)
          </p>
        </>
      )}

      {status === 'verifying' && (
        <>
          <Loader2 size={64} color="var(--accent-primary)" style={{ animation: 'spin 1.5s linear infinite' }} />
          <h2 style={{ marginTop: '1.5rem' }}>正在建立 100% 安全體驗...</h2>
          <p className="text-muted" style={{ marginTop: '0.5rem' }}>透過地理圍欄與動態密碼驗證中</p>
        </>
      )}

      {status === 'success' && (
        <>
          <ShieldCheck size={80} color="#4ade80" />
          <h2 style={{ marginTop: '1.5rem', color: '#4ade80' }}>驗證成功！</h2>
          <p className="text-muted" style={{ marginTop: '0.5rem' }}>正在進入專屬候車區...</p>
        </>
      )}

      {status === 'error' && (
        <>
          <XCircle size={80} color="#f87171" />
          <h2 style={{ marginTop: '1.5rem', color: '#f87171' }}>驗證失敗</h2>
          <p className="text-muted" style={{ marginTop: '0.5rem' }}>{errMsg}</p>
          <p style={{ marginTop: '2rem', color: '#fff', fontSize: '1.1rem' }}>
            請重新掃描螢幕上的最新 QR Code
          </p>
        </>
      )}
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default ScanPage;
