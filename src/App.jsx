import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import Leaves from "./pages/Leaves";
import Hiring from "./pages/Hiring";

function AppContent() {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="p-6 text-slate-500">Loading…</div>;
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
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
