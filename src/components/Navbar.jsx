
import { NavLink, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { useState } from "react";
import { FiLogOut } from "react-icons/fi";
import { auth } from "../firebase";
import { canAccessPage } from "../App";
import "./Navbar.css";

const navigation = [
  { to: "/dashboard", key: "dashboard", label: "Dashboard" },
  { to: "/medicine-sales", key: "medicineSales", label: "Mauzo" },
  { to: "/stock-purchases", key: "stockPurchases", label: "Manunuzi" },
  { to: "/balances", key: "balances", label: "Madeni" },
  { to: "/settings", key: "settings", label: "Mengineyo" },
  { to: "/reports", key: "reports", label: "Reports" }
];

const Navbar = ({ profile, authEmail }) => {
  const navigate = useNavigate();
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);

    try {
      await signOut(auth);
      navigate("/", { replace: true });
    } catch (error) {
      console.error("Logout failed:", error);
      alert("Unable to log out. Please try again.");
    } finally {
      setLoggingOut(false);
      setShowLogoutDialog(false);
    }
  };

  return (
    <nav className="navbar">
      <div className="nav-links">
        {navigation
          .filter(item =>
            canAccessPage(profile, item.key, authEmail)
          )
          .map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "active" : ""
              }
            >
              {item.label}
            </NavLink>
          ))}
      </div>

      <div className="logout-link">
        <button
          type="button"
          onClick={() => setShowLogoutDialog(true)}
        >
          <FiLogOut style={{ marginRight: "5px" }} />
          Log Out
        </button>
      </div>

      {showLogoutDialog && (
        <div className="alert-dialog-backdrop">
          <div
            className="alert-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
          >
            <h3 id="logout-title">Confirm Logout</h3>
            <p>Are you sure you want to log out?</p>

            <div className="dialog-buttons">
              <button
                className="confirm-btn"
                onClick={handleLogout}
                disabled={loggingOut}
              >
                {loggingOut ? "Logging out..." : "Yes"}
              </button>

              <button
                className="cancel-btn"
                onClick={() => setShowLogoutDialog(false)}
                disabled={loggingOut}
              >
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
