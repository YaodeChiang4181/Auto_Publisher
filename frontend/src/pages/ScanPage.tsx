import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ShieldCheck, XCircle, Loader2 } from 'lucide-react';

const ScanPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errMsg, setErr] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setErr('無效的 QR Code (Missing Token)');
      return;
    }

    const verifyToken = async () => {
      try {
        const res = await fetch(`/api/qr/scan?token=${token}`);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || '驗證失敗');
        }

        // Store session token securely
        localStorage.setItem('sessionToken', data.sessionToken);
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

    // Simulate minimal loading time for premium feel
    setTimeout(verifyToken, 800);
  }, [searchParams, navigate]);

  return (
    <div className="glass-panel flex-center" style={{ minHeight: '300px', flexDirection: 'column' }}>
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
          <button className="btn-primary" style={{ marginTop: '2rem' }} onClick={() => navigate('/')}>
            返回首頁
          </button>
        </>
      )}
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default ScanPage;
