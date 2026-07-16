import { Component } from "react";

// Without a boundary, any render error unmounts the whole tree — a white
// screen with the reason visible only in the console.
export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Render error:", error, info.componentStack); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app-content flex min-h-screen items-center justify-center p-6">
        <div className="ui-card max-w-md p-8 text-center">
          <h1 className="font-heading text-xl font-bold text-slate-900 dark:text-white">Something went wrong</h1>
          <p className="mt-3 break-words text-sm text-slate-600 dark:text-slate-300">
            {String(this.state.error?.message ?? this.state.error)}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-psa-blue px-4 py-2 text-sm font-semibold text-white transition hover:bg-psa-blue/90"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
