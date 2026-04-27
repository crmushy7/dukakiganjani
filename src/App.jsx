import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Purchases from './pages/Purchases';
import Debts from './pages/Debts';
import Reports from './pages/Reports';
import Navbar from './components/Navbar';
import Others from './pages/Others';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  return (
    <Router>
      {isAuthenticated && <Navbar />}

      <Routes>
        {/* Login */}
        <Route
          path="/"
          element={
            isAuthenticated ? <Navigate to="/dashboard" /> : <Login onLogin={handleLogin} />
          }
        />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={isAuthenticated ? <Dashboard /> : <Navigate to="/" />}
        />

        {/* Medicine Sales */}
        <Route
          path="/medicine-sales"
          element={isAuthenticated ? <Sales /> : <Navigate to="/" />}
        />

        {/* Stock Purchases */}
        <Route
          path="/stock-purchases"
          element={isAuthenticated ? <Purchases /> : <Navigate to="/" />}
        />

        {/* Patient & Supplier Balances */}
        <Route
          path="/balances"
          element={isAuthenticated ? <Debts /> : <Navigate to="/" />}
        />

        {/* Reports */}
        <Route
          path="/reports"
          element={isAuthenticated ? <Reports /> : <Navigate to="/" />}
        />

        {/* Misc / Settings */}
        <Route
          path="/settings"
          element={isAuthenticated ? <Others /> : <Navigate to="/" />}
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" />} />

      </Routes>
    </Router>
  );
}

export default App;