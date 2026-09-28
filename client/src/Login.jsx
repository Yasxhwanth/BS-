import { useState } from 'react';
import { login, register } from './api';

export default function Login({ onLogin }) {
  const [mode, setMode]       = useState('login');   // 'login' | 'register'
  const [form, setForm]       = useState({ name: '', email: '', password: '', role: 'operator', department: 'Production' });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fn   = mode === 'login' ? login : register;
      const body = mode === 'login' ? { email: form.email, password: form.password } : form;
      const { data } = await fn(body);
      localStorage.setItem('aip_token', data.token);
      localStorage.setItem('aip_user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left Panel */}
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-brand">
            <div className="auth-brand-hex" />
            <span className="auth-brand-name">ManufactureAIP</span>
          </div>
          <h1 className="auth-tagline">
            AI-Powered<br />Manufacturing<br />Intelligence
          </h1>
          <p className="auth-subtitle">
            Build ontology-driven knowledge graphs, predict failures before they happen, and optimize your plant with real-time AI insights.
          </p>
          <div className="auth-features">
            {[
              'Interactive Digital Twin Studio with ReactFlow',
              'Auto-generated OWL knowledge graph',
              'Predictive maintenance AI engine',
              'Real-time sensor monitoring & alerts',
              'AI chatbot with plant context awareness',
            ].map(f => (
              <div key={f} className="auth-feature">
                <div className="auth-feature-dot" />
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="auth-right">
        <div className="auth-form-box">
          <h2 className="auth-form-title">
            {mode === 'login' ? 'Sign in to your account' : 'Create account'}
          </h2>
          <p className="auth-form-sub">
            {mode === 'login'
              ? 'Enter your credentials to access the platform'
              : 'Fill in your details to get started'}
          </p>

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" name="name" placeholder="John Smith" value={form.name} onChange={handleChange} required />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input className="form-input" type="email" name="email" placeholder="you@company.com" value={form.email} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-input" type="password" name="password" placeholder="••••••••" value={form.password} onChange={handleChange} required />
            </div>
            {mode === 'register' && (
              <>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-select" name="role" value={form.role} onChange={handleChange}>
                    <option value="operator">Operator</option>
                    <option value="engineer">Engineer</option>
                    <option value="analyst">Analyst</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-select" name="department" value={form.department} onChange={handleChange}>
                    <option>Production</option>
                    <option>Maintenance</option>
                    <option>QA</option>
                    <option>Management</option>
                  </select>
                </div>
              </>
            )}
            {error && <p className="form-error" style={{ marginBottom: 12 }}>{error}</p>}
            <button className="btn btn-primary w-full" type="submit" disabled={loading} style={{ justifyContent: 'center', marginTop: 8 }}>
              {loading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : null}
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="form-divider"><span>or</span></div>

          <button className="btn btn-ghost w-full" style={{ justifyContent: 'center' }}
            onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}>
            {mode === 'login' ? 'Create a new account' : 'Already have an account? Sign in'}
          </button>

          {/* Demo credentials */}
          <div style={{ marginTop: 24, padding: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 4, fontSize: 12, color: 'var(--text-helper)' }}>
            <div style={{ marginBottom: 4, color: 'var(--text-secondary)', fontWeight: 600 }}>Quick Demo Account:</div>
            <div>Email: <strong style={{ color: 'var(--text-primary)' }}>admin@company.com</strong></div>
            <div>Password: <strong style={{ color: 'var(--text-primary)' }}>password123</strong></div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: 8, padding: '4px 8px', fontSize: 11, height: 'auto', border: '1px solid var(--border-subtle)' }}
              onClick={() => {
                setMode('login');
                setForm(f => ({ ...f, email: 'admin@company.com', password: 'password123' }));
              }}
            >
              Fill Demo Credentials
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
