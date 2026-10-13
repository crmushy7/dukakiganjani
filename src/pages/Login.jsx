import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import './Login.css';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();

    if (loading) return;

    setLoading(true);

    try {
      await signInWithEmailAndPassword(
  auth,
  email.trim(),
  password
);
    } catch (error) {
      console.error('Login error:', error);

      alert(
        error.code === 'auth/invalid-credential'
          ? 'Email au password si sahihi. Tafadhali jaribu tena.'
          : error.code === 'auth/too-many-requests'
          ? 'Majaribio mengi sana. Tafadhali subiri kisha ujaribu tena.'
          : 'Imeshindikana kuingia. Angalia taarifa zako na internet.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Duka Kiganjani!</h2>

        <form onSubmit={handleLogin}>
          <div className="input-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              placeholder="Ingiza email yako"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>

            <div className="password-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Ingiza neno la siri"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />

              <button
                type="button"
                onClick={() => setShowPassword((previous) => !previous)}
                className="show-btn"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? 'Inaingia...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;