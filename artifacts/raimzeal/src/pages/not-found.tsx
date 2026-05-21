import { Link } from 'wouter';

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background px-6">
      <div className="text-center space-y-5 max-w-sm w-full">
        <p className="text-7xl font-black text-primary/30">404</p>
        <h1 className="text-2xl font-bold text-foreground">Page not found</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          The link may be broken or the page may have moved. Head back home and keep going.
        </p>
        <Link href="/">
          <button className="mt-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
            Back to Home
          </button>
        </Link>
        <p className="text-xs text-muted-foreground/50 pt-2">
          RAIMZEAL · Created and powered by ECONTEUR LLC
        </p>
      </div>
    </div>
  );
}
