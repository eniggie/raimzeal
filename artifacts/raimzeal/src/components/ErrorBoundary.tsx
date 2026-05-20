import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary] Unhandled render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
          <div className="space-y-6 max-w-sm">
            <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto text-4xl">
              ⚠
            </div>
            <div>
              <h1 className="text-2xl font-bold font-display mb-2">Something went wrong</h1>
              <p className="text-muted-foreground text-sm">
                An unexpected error occurred. Try refreshing the page — if the problem
                persists, contact support.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => this.setState({ hasError: false })}
                className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
              >
                Try again
              </button>
              <a
                href="/"
                className="w-full h-11 rounded-lg border border-input flex items-center justify-center text-sm font-medium hover:bg-accent transition-colors"
              >
                Back to home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
