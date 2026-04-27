import { NavLink, useNavigate } from 'react-router-dom';
import './Navbar.css';
import { FiLogOut } from 'react-icons/fi';
import { useState } from 'react';

const Navbar = () => {
  const navigate = useNavigate();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  const handleLogout = () => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  return (
    <nav className="navbar">
      <div className="nav-links">

        <NavLink to="/dashboard" className={({ isActive }) => isActive ? "active" : ""}>
          Dashboardss
        </NavLink>

        <NavLink to="/medicine-sales" className={({ isActive }) => isActive ? "active" : ""}>
          Mauzo
        </NavLink>

        <NavLink to="/stock-purchases" className={({ isActive }) => isActive ? "active" : ""}>
          Manunuzi
        </NavLink>

        <NavLink to="/balances" className={({ isActive }) => isActive ? "active" : ""}>
          Madeni
        </NavLink>

        <NavLink to="/settings" className={({ isActive }) => isActive ? "active" : ""}>
          Mengineyo
        </NavLink>

        <NavLink to="/reports" className={({ isActive }) => isActive ? "active" : ""}>
          Reports
        </NavLink>

        

      </div>

      <div className="logout-link">
        <button onClick={() => setShowLogoutDialog(true)}>
          <FiLogOut style={{ marginRight: '5px' }} />
          Log Out
        </button>
      </div>

      {showLogoutDialog && (
        <div className="alert-dialog-backdrop">
          <div className="alert-dialog">
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to log out?</p>

            <div className="dialog-buttons">
              <button className="confirm-btn" onClick={handleLogout}>
                Yes
              </button>
              <button className="cancel-btn" onClick={() => setShowLogoutDialog(false)}>
                No
              </button>
            </div>

          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;