import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import UserGuide from "@/pages/UserGuide";
import DeveloperGuide from "@/pages/DeveloperGuide";
import OperationsGuide from "@/pages/OperationsGuide";
import logoImg from "@assets/002FEB67-8D79-4211-94B8-51ECBB9D3E78_1781989043230.png";

const queryClient = new QueryClient();

function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/user-guide", label: "User Guide" },
    { href: "/developer-guide", label: "Developer Guide" },
    { href: "/operations-guide", label: "Operations Guide" },
  ];

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border flex flex-col z-10">
      <div className="p-6 border-b border-border">
        <Link href="/">
          <img src={logoImg} alt="RAIMZEAL" className="h-8 w-auto mb-2 cursor-pointer" />
          <div className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            Documentation Suite
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location === item.href
                  ? "bg-primary/10 text-primary border-l-2 border-primary pl-2"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="p-4 border-t border-border">
        <div className="text-xs text-muted-foreground">
          RAIMZEAL v1.3.0
        </div>
        <div className="text-xs text-muted-foreground">
          ECONTEUR LLC — June 2026
        </div>
      </div>
    </aside>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 min-h-screen">
        {children}
      </main>
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/user-guide" component={UserGuide} />
        <Route path="/developer-guide" component={DeveloperGuide} />
        <Route path="/operations-guide" component={OperationsGuide} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
