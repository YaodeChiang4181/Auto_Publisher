import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ticket, MessagesSquare, Gift } from 'lucide-react';

const UnlockPage = () => {
  const navigate = useNavigate();
  const sessionToken = localStorage.getItem('sessionToken');
  const eventId = localStorage.getItem('eventId');

  useEffect(() => {
    // If somehow landed here without a session, boot them back to root
    if (!sessionToken) {
      navigate('/', { replace: true });
    }
  }, [sessionToken, navigate]);

  return (
    <div style={{ animation: 'fade-in 0.8s ease-out' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className="title-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>
          解鎖成功
        </h1>
        <p className="text-muted">歡迎來到這場活動的專屬深度空間</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Card 1: Easter Egg */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s', borderLeft: '4px solid var(--accent-primary)' }}>
          <div style={{ background: 'rgba(88,166,255,0.15)', padding: '1rem', borderRadius: '12px' }}>
            <Ticket size={32} color="var(--accent-primary)" />
          </div>
          <div>
            <h3 style={{ marginBottom: '0.25rem', fontSize: '1.2rem' }}>導演隱藏彩蛋解析</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>解開剛才畫面中一閃而過的神秘細節...</p>
          </div>
        </div>

        {/* Card 2: Discussion */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s', borderLeft: '4px solid var(--accent-secondary)' }}>
          <div style={{ background: 'rgba(138,43,226,0.15)', padding: '1rem', borderRadius: '12px' }}>
            <MessagesSquare size={32} color="var(--accent-secondary)" />
          </div>
          <div>
            <h3 style={{ marginBottom: '0.25rem', fontSize: '1.2rem' }}>無雷封閉討論區</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>超過 1,200 位同場觀眾正在熱烈討論中</p>
          </div>
        </div>

        {/* Card 3: Merch */}
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: '1.5rem', cursor: 'pointer', transition: 'transform 0.2s', borderLeft: '4px solid #f472b6' }}>
          <div style={{ background: 'rgba(244,114,182,0.15)', padding: '1rem', borderRadius: '12px' }}>
            <Gift size={32} color="#f472b6" />
          </div>
          <div>
            <h3 style={{ marginBottom: '0.25rem', fontSize: '1.2rem' }}>現場專屬周邊 8 折</h3>
            <p className="text-muted" style={{ fontSize: '0.9rem' }}>出示此畫面至外圍商店購買限量商品</p>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .glass-panel:hover {
          transform: translateX(8px);
        }
      `}</style>
    </div>
  );
};

export default UnlockPage;
