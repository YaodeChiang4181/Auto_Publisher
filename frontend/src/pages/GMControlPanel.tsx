import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';

const GMControlPanel = () => {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('line_linked') === 'true') {
      alert('綁定成功！您將能收到拖場預警訊息。');
      window.history.replaceState({}, document.title, location.pathname);
    } else if (searchParams.get('error') === 'auth_failed') {
      alert('綁定失敗或已取消授權');
      window.history.replaceState({}, document.title, location.pathname);
    }
    fetchEventData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, searchParams]);

  const fetchEventData = async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/gm/${token}`);
      if (!res.ok) {
        throw new Error('找不到活動或已過期');
      }
      const data = await res.json();
      setEvent(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };


  const handleStartLineLogin = () => {
    window.location.href = `/api/line/auth?gmToken=${token}`;
  };

  const handleDelay = async (minutes: number) => {
    if (!confirm(`確定要將發送時間延後 ${minutes} 分鐘嗎？`)) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/gm/${token}/delay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minutes })
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '延後失敗');
      }
      alert('已成功延後發送時間！');
      fetchEventData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handlePushNow = async () => {
    if (!confirm('警告：確定要「立即」發送散場推播嗎？這會立刻將彩蛋推播給所有掃碼的玩家！')) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/gm/${token}/push-now`, {
        method: 'POST'
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '發送失敗');
      }
      alert('已立即發送推播！');
      fetchEventData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div style={{ color: 'white', textAlign: 'center', marginTop: '50px' }}>載入中...</div>;
  }

  if (error || !event) {
    return <div style={{ color: '#ff6b6b', textAlign: 'center', marginTop: '50px' }}>{error || '發生錯誤'}</div>;
  }

  const unlockTime = new Date(event.unlockTime);
  const now = new Date();
  const isUnlocked = now >= unlockTime;

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', minHeight: '100vh', background: '#111', color: 'white', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', color: 'var(--accent-primary)' }}>GM 控制台</h1>
        <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 'normal' }}>{event.name}</h2>
      </div>

      {!event.gmLineUserId && (
        <div style={{ background: 'rgba(250, 204, 21, 0.1)', border: '1px solid #facc15', padding: '1rem', borderRadius: '12px', textAlign: 'center' }}>
          <p style={{ color: '#facc15', margin: '0 0 1rem 0', fontSize: '0.9rem' }}>您尚未綁定 LINE 帳號，將無法收到 10 分鐘前的防呆預警！</p>
          <button 
            onClick={handleStartLineLogin}
            style={{ width: '100%', background: '#06C755', color: 'white', border: 'none', padding: '0.8rem', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            使用 LINE 登入綁定
          </button>
        </div>
      )}

      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '1.5rem', textAlign: 'center' }}>
        <p style={{ color: '#aaa', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>預計發送推播時間</p>
        <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: isUnlocked ? '#4ade80' : 'white', marginBottom: '0.5rem' }}>
          {unlockTime.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <p style={{ margin: 0, color: isUnlocked ? '#4ade80' : '#ffaa00', fontSize: '0.9rem' }}>
          {isUnlocked ? '已發送完畢！' : '等待發送中...'}
        </p>
      </div>

      {!isUnlocked && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button 
            onClick={() => handleDelay(15)}
            disabled={actionLoading}
            style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', padding: '1rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ⏳ 拖場：延後 15 分鐘
          </button>

          <button 
            onClick={() => handleDelay(30)}
            disabled={actionLoading}
            style={{ width: '100%', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', padding: '1rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}
          >
            ⏳ 拖場：延後 30 分鐘
          </button>

          <div style={{ margin: '1rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}></div>

          <button 
            onClick={handlePushNow}
            disabled={actionLoading}
            style={{ width: '100%', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', padding: '1rem', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer' }}
          >
            🔴 提早結束：立即發送推播
          </button>
        </div>
      )}

      {isUnlocked && (
        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <p style={{ color: '#aaa', fontSize: '0.9rem' }}>本場次已結束，玩家應該已收到推播。</p>
        </div>
      )}
    </div>
  );
};

export default GMControlPanel;
