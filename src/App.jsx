import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Sidebar from "./components/Sidebar";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import Leaves from "./pages/Leaves";
import ReviewQueue from "./pages/ReviewQueue";
import Attendance from "./pages/Attendance";
import LeaveCard from "./pages/LeaveCard";
import Accounts from "./pages/Accounts";
import Hiring from "./pages/Hiring";

function AppContent() {
  const { session, loading } = useAuth();

  if (loading) return <div className="p-6 text-slate-500">Loading…</div>;
  // if (!session) return <LoginPage />;

  return (
    <div className="app-content flex text-slate-800 dark:text-slate-200">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leaves" element={<Leaves />} />
          <Route path="/review" element={<ReviewQueue />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/card" element={<LeaveCard />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/hiring" element={<Hiring />} />
        </Routes>
      </main>
    </div>
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
