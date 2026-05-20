import { createRoot } from "react-dom/client";
import { Component, type ErrorInfo, type ReactNode } from "react";
import App from "./App";
import "./index.css";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#0a0a0b', color: '#e5e5e5', minHeight: '100vh', padding: '2rem', fontFamily: 'monospace' }}>
          <h1 style={{ color: '#ef4444', marginBottom: '1rem' }}>RAIMZEAL — App Error</h1>
          <pre style={{ background: '#1a1a1b', padding: '1rem', borderRadius: '8px', overflow: 'auto', color: '#fca5a5' }}>
            {this.state.error.message}
          </pre>
          <pre style={{ background: '#1a1a1b', padding: '1rem', borderRadius: '8px', overflow: 'auto', fontSize: '0.75rem', color: '#9ca3af', marginTop: '1rem' }}>
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
