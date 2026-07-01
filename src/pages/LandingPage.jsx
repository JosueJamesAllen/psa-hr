import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

function FeatureCard({ title, desc, accent }) {
  return (
    <div className="rounded-xl border border-slate-200 p-5 text-left dark:border-slate-800">
      <div className={`mb-2 h-1 w-10 rounded ${accent}`} />
      <h3 className="font-heading text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{desc}</p>
    </div>
  );
}

export default function LandingPage() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="font-heading font-bold text-psa-blue dark:text-white">
          PSA Marinduque HR
        </span>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex max-w-3xl flex-col items-center px-6 py-20 text-center">
        <span className="mb-4 inline-block rounded-full bg-psa-blue/10 px-3 py-1 text-sm font-medium text-psa-blue dark:bg-psa-blue/20 dark:text-blue-300">
          Philippine Statistics Authority · Marinduque
        </span>

        <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
          HR Leave &amp; Hiring Portal
        </h1>

        <p className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
          File and track employee leaves and manage hiring in one place, aligned
          with CSC rules and office signatory routing.
        </p>

        <button
          onClick={signInWithGoogle}
          className="mt-8 rounded-lg bg-psa-blue px-6 py-3 font-medium text-white transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-psa-blue focus:ring-offset-2 dark:focus:ring-offset-slate-950"
        >
          Sign in with Google
        </button>

        <div className="mt-16 grid w-full gap-4 sm:grid-cols-2">
          <FeatureCard
            title="Leaves"
            desc="VL, SL, and wellness leave filing with credit tracking and signatory routing."
            accent="bg-psa-blue"
          />
          <FeatureCard
            title="Hiring"
            desc="Manage the hiring workflow for regular, contractual, and COSW staff."
            accent="bg-psa-red"
          />
        </div>
      </main>

      <footer className="py-8 text-center text-xs text-slate-400">
        PSA Marinduque · Internal HR use only
      </footer>
    </div>
  );
}
