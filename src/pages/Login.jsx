import React, { useState } from 'react';
import './Login.css';

const Login = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = () => {

    if (email === 'reha26' && password === 'viane77') {
       onLogin(); 
    } else {
      alert('Jina la mtumiaji au neno la siri si sahihi. Tafadhali jaribu tena.');
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">💊 Medical Hub</h2>

        <div className="input-group">
          <label>Username</label>
          <input
            type="email"
            placeholder="Ingiza jina la mtumiaji"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="input-group">
          <label>Password</label>
          <div className="password-wrapper">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="Ingiza neno la siri"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button type="button" onClick={togglePasswordVisibility} className="show-btn">
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <button className="login-button" onClick={handleLogin}>
          Login
        </button>
      </div>
    </div>
  );
};

export default Login;