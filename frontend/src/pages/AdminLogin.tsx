import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../index.css';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.requires2FA) {
        setRequires2FA(true);
        setTempToken(data.tempToken);
        setLoading(false);
        return;
      }

      // 儲存 使用者資訊 (Token 已由後端透過 HttpOnly Cookie 寫入)
      localStorage.setItem('adminUser', JSON.stringify(data.user));
      
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/admin/verify-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tempToken, token: twoFactorCode })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '2FA Verification failed');
      }

      // 儲存 使用者資訊 (Token 已由後端透過 HttpOnly Cookie 寫入)
      localStorage.setItem('adminUser', JSON.stringify(data.user));
      
      navigate('/admin/dashboard');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '400px', margin: '4rem auto', padding: '2rem' }} className="glass-panel">
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h2 className="title-gradient" style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>AutoPublisher B2B</h2>
        <p className="text-muted">{requires2FA ? 'Enter 2FA Code' : 'Sign in to manage your venue and projections'}</p>
      </div>

      {!requires2FA ? (
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label htmlFor="username" style={{ display: 'block', marginBottom: '0.5rem', color: '#fff' }}>
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: 'white',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
            />
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', marginBottom: '0.5rem', color: '#fff' }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: 'white',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
            />
          </div>

          {error && (
            <div style={{ color: '#ff6b6b', fontSize: '0.9rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'var(--accent-primary)',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
              marginTop: '1rem'
            }}
            onMouseOver={(e) => {
              if (!loading) e.currentTarget.style.boxShadow = '0 0 15px var(--accent-primary)';
            }}
            onMouseOut={(e) => {
              if (!loading) e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify2FA} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <label htmlFor="twoFactorCode" style={{ display: 'block', marginBottom: '0.5rem', color: '#fff', textAlign: 'center' }}>
              6-Digit Authenticator Code
            </label>
            <input
              id="twoFactorCode"
              name="twoFactorCode"
              type="text"
              required
              maxLength={6}
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '8px',
                color: 'white',
                outline: 'none',
                textAlign: 'center',
                letterSpacing: '0.2rem',
                fontSize: '1.2rem'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-primary)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)'}
            />
          </div>

          {error && (
            <div style={{ color: '#ff6b6b', fontSize: '0.9rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'var(--accent-primary)',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '1rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
              marginTop: '1rem'
            }}
          >
            {loading ? 'Verifying...' : 'Verify'}
          </button>
          
          <button
            type="button"
            onClick={() => {
              setRequires2FA(false);
              setTempToken('');
              setTwoFactorCode('');
              setError('');
            }}
            style={{
              background: 'transparent',
              color: 'var(--accent-primary)',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            Cancel
          </button>
        </form>
      )}
    </div>
  );
};

export default AdminLogin;
