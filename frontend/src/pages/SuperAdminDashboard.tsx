import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Building2, Users, Megaphone, Plus, LogOut } from 'lucide-react';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  
  const [stats, setStats] = useState<any>(null);
  const [venues, setVenues] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  // Form states (simplified for POC)
  const [newVenueName, setNewVenueName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const userData = localStorage.getItem('adminUser');
      if (!userData) {
        navigate('/admin/login');
        return;
      }
      
      const parsedUser = JSON.parse(userData);
      if (parsedUser.role !== 'SUPER_ADMIN') {
        navigate('/admin/dashboard');
        return;
      }
      setUser(parsedUser);
      
      try {
        const [statsRes, venuesRes, usersRes, campaignsRes] = await Promise.all([
          fetch('/api/superadmin/stats'),
          fetch('/api/superadmin/venues'),
          fetch('/api/superadmin/users'),
          fetch('/api/superadmin/campaigns')
        ]);
        
        if (statsRes.status === 401 || statsRes.status === 403) {
          navigate('/admin/login');
          return;
        }

        setStats(await statsRes.json());
        setVenues(await venuesRes.json());
        setUsers(await usersRes.json());
        setCampaigns(await campaignsRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('adminUser');
    document.cookie = 'adminToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    navigate('/admin/login');
  };

  const handleCreateVenue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/superadmin/venues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newVenueName, geoLat: 0, geoLng: 0, geoRadius: 100 })
      });
      if (res.ok) {
        const newVenue = await res.json();
        setVenues([newVenue, ...venues]);
        setNewVenueName('');
        alert('場館建立成功');
      }
    } catch (e) {
      alert('建立失敗');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/superadmin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, name: newUsername, role: 'VENUE_MANAGER' })
      });
      if (res.ok) {
        const newUser = await res.json();
        setUsers([newUser, ...users]);
        setNewUsername('');
        setNewPassword('');
        alert('帳號建立成功');
      } else {
        const err = await res.json();
        alert('建立失敗: ' + err.error);
      }
    } catch (e) {
      alert('建立失敗');
    }
  };

  if (loading) {
    return <div style={{ color: 'white', padding: '2rem' }}>載入中...</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '2rem', color: 'white', fontFamily: 'Inter, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, color: '#facc15', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity color="#facc15" /> 總營運中心 (Super Admin)
          </h1>
          <p className="text-muted" style={{ margin: '0.5rem 0 0 0' }}>管理全台場館與全域聯播網</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>歡迎, {user?.name}</span>
          <button onClick={handleLogout} style={{ background: 'rgba(255,0,0,0.2)', border: '1px solid red', color: 'red', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LogOut size={16} /> 登出
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '2rem' }}>
        {/* Sidebar */}
        <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { id: 'overview', icon: <Activity size={18} />, label: '營運總覽' },
            { id: 'venues', icon: <Building2 size={18} />, label: '場館管理' },
            { id: 'users', icon: <Users size={18} />, label: '帳號管理' },
            { id: 'campaigns', icon: <Megaphone size={18} />, label: '全域廣告活動' },
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.8rem',
                padding: '1rem',
                background: activeTab === tab.id ? 'rgba(250, 204, 21, 0.1)' : 'transparent',
                color: activeTab === tab.id ? '#facc15' : '#a1a1aa',
                border: activeTab === tab.id ? '1px solid rgba(250, 204, 21, 0.5)' : '1px solid transparent',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                transition: 'all 0.2s'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', padding: '2rem', minHeight: '600px' }}>
          
          {activeTab === 'overview' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#facc15' }}>營運總覽</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
                <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <h3 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', color: 'white' }}>{stats?.venueCount}</h3>
                  <div className="text-muted">合作場館</div>
                </div>
                <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <h3 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', color: 'white' }}>{stats?.userCount}</h3>
                  <div className="text-muted">管理員帳號</div>
                </div>
                <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
                  <h3 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', color: 'white' }}>{stats?.eventCount}</h3>
                  <div className="text-muted">累積活動</div>
                </div>
                <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center', background: 'rgba(250, 204, 21, 0.1)', border: '1px solid rgba(250, 204, 21, 0.3)' }}>
                  <h3 style={{ fontSize: '2rem', margin: '0 0 0.5rem 0', color: '#facc15' }}>{stats?.totalAdViews}</h3>
                  <div style={{ color: '#facc15', fontSize: '0.9rem' }}>全域廣告曝光次數</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'venues' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>場館管理</h2>
              <form onSubmit={handleCreateVenue} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <input 
                  type="text" 
                  value={newVenueName} 
                  onChange={e => setNewVenueName(e.target.value)} 
                  placeholder="新場館名稱 (如: 信義威秀)" 
                  style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }}
                />
                <button type="submit" style={{ background: 'white', color: 'black', padding: '0 1.5rem', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}>
                  <Plus size={18} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 新增場館
                </button>
              </form>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', color: '#a1a1aa' }}>
                    <th style={{ padding: '1rem' }}>場館名稱</th>
                    <th style={{ padding: '1rem' }}>狀態</th>
                    <th style={{ padding: '1rem' }}>經緯度</th>
                    <th style={{ padding: '1rem' }}>建立時間</th>
                  </tr>
                </thead>
                <tbody>
                  {venues.map(v => (
                    <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem', fontWeight: 'bold' }}>{v.name}</td>
                      <td style={{ padding: '1rem' }}><span style={{ background: v.isActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: v.isActive ? '#4ade80' : '#f87171', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>{v.status || (v.isActive ? 'ACTIVE' : 'INACTIVE')}</span></td>
                      <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#a1a1aa' }}>{v.geoLat}, {v.geoLng}</td>
                      <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#a1a1aa' }}>{new Date(v.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'users' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>帳號管理</h2>
              <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
                <input 
                  type="text" 
                  value={newUsername} 
                  onChange={e => setNewUsername(e.target.value)} 
                  placeholder="登入帳號 (Username)" 
                  style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }}
                />
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  placeholder="密碼" 
                  style={{ flex: 1, padding: '0.8rem', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', borderRadius: '4px' }}
                />
                <button type="submit" style={{ background: 'white', color: 'black', padding: '0 1.5rem', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}>
                  <Plus size={18} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> 新增帳號
                </button>
              </form>

              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', color: '#a1a1aa' }}>
                    <th style={{ padding: '1rem' }}>帳號</th>
                    <th style={{ padding: '1rem' }}>名稱</th>
                    <th style={{ padding: '1rem' }}>角色</th>
                    <th style={{ padding: '1rem' }}>綁定場館</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem' }}>{u.username}</td>
                      <td style={{ padding: '1rem', fontWeight: 'bold' }}>{u.name}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{ background: u.role === 'SUPER_ADMIN' ? 'rgba(250, 204, 21, 0.2)' : 'rgba(161, 161, 170, 0.2)', color: u.role === 'SUPER_ADMIN' ? '#facc15' : '#e4e4e7', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                          {u.role}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '0.9rem', color: '#a1a1aa' }}>{u.venue?.name || '無'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'campaigns' && (
            <div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>全域廣告活動管理</h2>
              <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', marginBottom: '2rem' }}>
                <Megaphone size={48} color="#facc15" style={{ margin: '0 auto', marginBottom: '1rem' }} />
                <h3>全域廣告活動功能</h3>
                <p className="text-muted" style={{ maxWidth: '500px', margin: '0 auto' }}>
                  在這裡，您可以建立跨場館推播的廣告活動 (Campaign)，管理不同檔期的廣告主專案。未來的版本將會整合動態上傳與排程。
                </p>
              </div>

              {campaigns.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#a1a1aa' }}>目前沒有任何全域廣告活動。</div>
              ) : (
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {campaigns.map(c => (
                    <div key={c.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{c.title}</h4>
                          <span style={{ background: c.isActive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', color: c.isActive ? '#4ade80' : '#f87171', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
                            {c.isActive ? '運行中' : '已暫停'}
                          </span>
                        </div>
                        <p className="text-muted" style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>贊助商: {c.sponsor}</p>
                        <p className="text-muted" style={{ margin: 0, fontSize: '0.8rem' }}>
                          排程: {new Date(c.startDate).toLocaleDateString()} - {new Date(c.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#facc15' }}>{c.ads?.length || 0}</div>
                        <div style={{ fontSize: '0.8rem', color: '#a1a1aa' }}>旗下廣告數</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
