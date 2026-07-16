import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import Sidebar from "./components/Sidebar";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";
import Leaves from "./pages/Leaves";
import ReviewQueue from "./pages/ReviewQueue";
import Attendance from "./pages/Attendance";
import LeaveCard from "./pages/LeaveCard";
import Accounts from "./pages/Accounts";
import Hiring from "./pages/Hiring";

function CenterCard({ title, children }) {
  const { signOut, user } = useAuth();
  return (
    <div className="app-content flex min-h-screen items-center justify-center p-6">
      <div className="ui-card max-w-md p-8 text-center">
        <h1 className="font-heading text-xl font-bold text-slate-900 dark:text-white">{title}</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{children}</p>
        {user && <p className="mt-4 text-xs text-slate-400">Signed in as {user.email}</p>}
        <button onClick={signOut} className="mt-5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
          Sign out
        </button>
      </div>
    </div>
  );
}

const Denied = () => (
  <div className="p-8">
    <div className="ui-card max-w-lg p-6">
      <h1 className="font-heading text-lg font-semibold text-slate-900 dark:text-white">Not available</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">You don't have access to this page.</p>
    </div>
  </div>
);

function AppContent() {
  const { session, loading, status, employee, isHrOrAdmin, seat } = useAuth();

  if (loading) return <div className="app-content flex min-h-screen items-center justify-center text-sm text-slate-500">Loading…</div>;
  if (!session) return <LoginPage />;
  if (status === "error")
    return <CenterCard title="Something went wrong">We couldn't load your profile. Please sign out and try again.</CenterCard>;
  if (status === "pending" || !employee)
    return <CenterCard title="Account awaiting approval">Your sign-in isn't linked to an employee record yet. HR has been notified — you'll get access once your account is approved.</CenterCard>;

  return (
    <div className="app-content flex text-slate-800 dark:text-slate-200">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/leaves" element={<Leaves />} />
          <Route path="/card" element={<LeaveCard />} />
          <Route path="/review" element={seat || isHrOrAdmin ? <ReviewQueue /> : <Denied />} />
          <Route path="/attendance" element={isHrOrAdmin ? <Attendance /> : <Denied />} />
          <Route path="/accounts" element={isHrOrAdmin ? <Accounts /> : <Denied />} />
          <Route path="/hiring" element={isHrOrAdmin ? <Hiring /> : <Denied />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
