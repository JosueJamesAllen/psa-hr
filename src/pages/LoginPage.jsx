import { useAuth } from "../context/AuthContext";
import bgPic from "../assets/background-pic.jfif";
import psaLogo from "../assets/forshtsandgiggles.png";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const { signInWithGoogle } = useAuth();

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center px-4"
      style={{ backgroundImage: `url(${bgPic})` }}
    >
      {/* Overlay: diagonal black scrim for readability + a soft blue glow (top-left) for brand accent */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(65% 55% at 22% 18%, rgba(37,99,235,0.34), transparent 70%), linear-gradient(135deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.64) 48%, rgba(0,0,0,0.88) 100%)",
        }}
      />

      <div className="glass-card relative w-full max-w-md text-left">
        <div className="flex items-center gap-3">
          <img
            src={psaLogo}
            alt="Philippine Statistics Authority seal"
            className="h-11 w-11 shrink-0 object-contain"
          />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">
              Philippine Statistics Authority
            </p>
            <p className="text-xs text-white/60">
              Marinduque Provincial Statistics Office
            </p>
            <p className="text-xs font-medium text-[#60a5fa]">
              HR Leave &amp; Hiring Portal
            </p>
          </div>
        </div>

        <h1 className="mt-8 font-heading text-4xl font-bold text-white">
          Sign In
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Sign in with your Google account to continue.
        </p>

        <button
          onClick={signInWithGoogle}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-medium text-white transition hover:bg-white/10 hover:shadow-[0_0_24px_rgba(96,165,250,0.25)] focus:outline-none focus:ring-2 focus:ring-[#60a5fa] focus:ring-offset-2 focus:ring-offset-transparent"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </div>
    </div>
  );
}
