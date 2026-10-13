
import React, { useEffect, useState } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "./firebase";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Sales from "./pages/Sales";
import Purchases from "./pages/Purchases";
import Debts from "./pages/Debts";
import Reports from "./pages/Reports";
import Navbar from "./components/Navbar";
import Others from "./pages/Others";

const pages = [
  { path: "/dashboard", key: "dashboard", element: <Dashboard /> },
  { path: "/medicine-sales", key: "medicineSales", element: <Sales /> },
  { path: "/stock-purchases", key: "stockPurchases", element: <Purchases /> },
  { path: "/balances", key: "balances", element: <Debts /> },
  { path: "/reports", key: "reports", element: <Reports /> },
  { path: "/settings", key: "settings", element: <Others /> }
];


export function canAccessPage(profile, permission, authEmail) {
  const email = authEmail?.trim().toLowerCase();

  // Administrator: full access.
  if (email === "admin@gmail.com") {
    return true;
  }

  // Dukani: all pages except Reports.
  if (email === "dukani@gmail.com") {
    return permission !== "reports";
  }

  // Other accounts continue using their Firestore permissions.
  if (!profile) return false;

  if (profile.role === "admin") {
    return true;
  }

  return profile.permissions?.[permission] === true;
}


function getFirstAllowedPath(profile, authEmail) {
  const firstPage = pages.find(page =>
    canAccessPage(profile, page.key, authEmail)
  );

  return firstPage?.path || null;
}

function AccessPending() {
  return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <h2>Account setup required</h2>
      <p>
        Your Firebase account exists, but its Duka Kiganjani
        permission profile has not been configured.
      </p>
      <button onClick={() => signOut(auth)}>
        Log Out
      </button>
    </div>
  );
}

function AccessDenied({ profile, authEmail }) {
  const destination = getFirstAllowedPath(profile, authEmail);

  if (destination) {
    return <Navigate to={destination} replace />;
  }

  return (
    <div style={{ padding: 24, textAlign: "center" }}>
      <h2>No pages assigned</h2>
      <p>Please contact your administrator to receive access.</p>
      <button onClick={() => signOut(auth)}>
        Log Out
      </button>
    </div>
  );
}

function ProtectedPage({ profile, authEmail, permission, children }) {
  if (!canAccessPage(profile, permission, authEmail)) {
    return (
      <AccessDenied
        profile={profile}
        authEmail={authEmail}
      />
    );
  }

  return children;
}

function AppContent() {
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState(false);

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, async user => {
      if (!active) return;

      setLoading(true);
      setAuthUser(user);
      setProfile(null);
      setProfileError(false);

      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));

        if (!active) return;

        if (snapshot.exists()) {
          setProfile(snapshot.data());
        }
      } catch (error) {
        console.error("Could not load user permissions:", error);

        if (active) {
          setProfileError(true);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading account...</div>;
  }

  if (profileError) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <h2>Unable to load permissions</h2>
        <p>Check your connection or contact your administrator.</p>
        <button onClick={() => signOut(auth)}>Log Out</button>
      </div>
    );
  }

  const authEmail = authUser?.email;

  return (
    <>
      {authUser && profile && (
        <Navbar
          profile={profile}
          authEmail={authEmail}
        />
      )}

      <Routes>
        <Route
          path="/"
          element={
            !authUser ? (
              <Login />
            ) : !profile ? (
              <AccessPending />
            ) : (
              <Navigate
                to={getFirstAllowedPath(profile, authEmail) || "/no-access"}
                replace
              />
            )
          }
        />

        {pages.map(page => (
          <Route
            key={page.path}
            path={page.path}
            element={
              !authUser ? (
                <Navigate to="/" replace />
              ) : !profile ? (
                <AccessPending />
              ) : (
                <ProtectedPage
                  profile={profile}
                  authEmail={authEmail}
                  permission={page.key}
                >
                  {page.element}
                </ProtectedPage>
              )
            }
          />
        ))}

        <Route
          path="/no-access"
          element={
            authUser && profile ? (
              <AccessDenied
                profile={profile}
                authEmail={authEmail}
              />
            ) : (
              <Navigate to="/" replace />
            )
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
