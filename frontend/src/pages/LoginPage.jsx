import { browserStorage } from '../services/api';
import { useState } from 'react';
import { Leaf } from 'lucide-react';

export default function LoginPage({ onLogin }) {
  const [name, setName] = useState('');
  const [btId, setBtId] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !btId.trim()) {
      setError('Please fill in both fields to continue.');
      return;
    }
    sessionStorage.setItem('student_name', name.trim());
    sessionStorage.setItem('student_bt_id', btId.trim());
    onLogin(name.trim());
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        {/* Brand */}
        <div style={styles.brand}>
          <span style={styles.brandSymbol}>
            <Leaf size={20} strokeWidth={1.8} />
          </span>
          <span style={styles.brandText}>
            spendwise<span style={styles.brandPeriod}>.</span>
          </span>
        </div>

        <h1 style={styles.heading}>Welcome</h1>
        <p style={styles.subheading}>
          {browserStorage
            ? 'Choose a local workspace. Your name and BT ID stay in this browser; this is not a secure account login.'
            : 'Enter your details to access your workspace.'}
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="student-name">
              Student Name
            </label>
            <input
              id="student-name"
              type="text"
              className="form-control"
              placeholder="e.g. Riya Sharma"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              autoFocus
              autoComplete="name"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label} htmlFor="bt-id">
              BT ID (College ID)
            </label>
            <input
              id="bt-id"
              type="text"
              className="form-control"
              placeholder="e.g. BT22CS001"
              value={btId}
              onChange={(e) => {
                setBtId(e.target.value);
                setError('');
              }}
              autoComplete="off"
            />
          </div>

          {error && <p style={styles.errorMsg}>{error}</p>}

          <button type="submit" className="btn btn-primary" style={styles.submitBtn}>
            Continue to Workspace
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    minHeight: '100vh',
    background: 'var(--canvas)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    background: '#fff',
    border: '1px solid var(--line)',
    borderRadius: '16px',
    padding: '44px 40px 40px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 4px 24px rgba(23,62,50,0.07)',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    marginBottom: '36px',
    fontFamily: 'Manrope, sans-serif',
    fontWeight: 800,
    fontSize: '22px',
    letterSpacing: '-1.1px',
    color: 'var(--ink)',
    textDecoration: 'none',
  },
  brandSymbol: {
    width: '32px',
    height: '36px',
    borderRadius: '11px 11px 11px 3px',
    color: 'var(--green)',
    display: 'grid',
    placeItems: 'center',
    background: '#e7efd9',
    transform: 'rotate(-5deg)',
    flexShrink: 0,
  },
  brandText: {
    fontFamily: 'Manrope, sans-serif',
  },
  brandPeriod: {
    color: '#8eae6a',
    marginLeft: '-2px',
  },
  heading: {
    fontSize: '26px',
    fontWeight: 750,
    letterSpacing: '-0.9px',
    margin: '0 0 6px',
    color: 'var(--ink)',
  },
  subheading: {
    fontSize: '12px',
    color: 'var(--muted)',
    margin: '0 0 28px',
  },
  fieldGroup: {
    marginBottom: '18px',
  },
  label: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    color: '#52634f',
    marginBottom: '7px',
    letterSpacing: '0.1px',
  },
  errorMsg: {
    fontSize: '11px',
    color: '#b64f3a',
    margin: '-6px 0 14px',
  },
  submitBtn: {
    width: '100%',
    marginTop: '8px',
    padding: '12px',
    fontSize: '13px',
    fontWeight: 600,
    justifyContent: 'center',
  },
};
