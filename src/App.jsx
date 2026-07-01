import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import LandingPage from "./pages/LandingPage";
import Leaves from "./pages/Leaves";
import Hiring from "./pages/Hiring";

function AppContent() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="p-6 text-slate-500">Loading…</div>;
  }

  if (!session) {
    return <LandingPage />;
  }

  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/leaves" replace />} />
          <Route path="/leaves" element={<Leaves />} />
          <Route path="/hiring" element={<Hiring />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
