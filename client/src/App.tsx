import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageTransition } from "@/components/ui/page-transitions";
import { FormLoadingSkeleton } from "@/components/ui/loading-components";
import { VersionDisplay } from "@/components/VersionDisplay";

// Lazy load large/non-critical pages for better performance
const MowerDetails = lazy(() => import("@/pages/MowerDetails"));
const AddServiceRecord = lazy(() => import("@/pages/AddServiceRecord"));
const EditServiceRecord = lazy(() => import("@/pages/EditServiceRecord"));

// Keep critical pages as regular imports for fast initial load
import Dashboard from "@/pages/Dashboard";
import MowerList from "@/pages/MowerList";
import AddMower from "@/pages/AddMower";
import EditMower from "@/pages/EditMower";
import PartsCatalog from "@/pages/PartsCatalog";
import PartDetails from "@/pages/PartDetails";
import ComponentDetails from "@/pages/ComponentDetails";
import AddComponent from "@/pages/AddComponent";
import Settings from "@/pages/Settings";
import Maintenance from "@/pages/Maintenance";
import MaintenanceHistory from "@/pages/MaintenanceHistory";
import Reports from "@/pages/Reports";
import NotFound from "@/pages/not-found";

// Loading fallback component
function PageLoadingFallback() {
  return (
    <PageTransition>
      <FormLoadingSkeleton fields={6} />
    </PageTransition>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <PageTransition><Dashboard /></PageTransition>} />
      <Route path="/mowers" component={() => <PageTransition><MowerList /></PageTransition>} />
      <Route path="/maintenance/history" component={() => <PageTransition><MaintenanceHistory /></PageTransition>} />
      <Route path="/maintenance" component={() => <PageTransition><Maintenance /></PageTransition>} />
      <Route path="/reports" component={() => <PageTransition><Reports /></PageTransition>} />
      <Route path="/catalog" component={() => <PageTransition><PartsCatalog /></PageTransition>} />
      <Route path="/catalog/parts/:partId" component={() => <PageTransition><PartDetails /></PageTransition>} />
      <Route path="/catalog/components/new" component={() => <PageTransition><AddComponent /></PageTransition>} />
      <Route path="/catalog/components/:componentId" component={() => <PageTransition><ComponentDetails /></PageTransition>} />
      <Route path="/settings" component={() => <PageTransition><Settings /></PageTransition>} />
      <Route path="/mowers/new" component={() => <PageTransition><AddMower /></PageTransition>} />
      <Route path="/mowers/:id/edit" component={() => <PageTransition><EditMower /></PageTransition>} />
      <Route 
        path="/mowers/:id/service/new" 
        component={() => (
          <Suspense fallback={<PageLoadingFallback />}>
            <PageTransition><AddServiceRecord /></PageTransition>
          </Suspense>
        )} 
      />
      <Route 
        path="/mowers/:id/service/:serviceId/edit" 
        component={() => (
          <Suspense fallback={<PageLoadingFallback />}>
            <PageTransition><EditServiceRecord /></PageTransition>
          </Suspense>
        )} 
      />
      <Route 
        path="/mowers/:id" 
        component={() => (
          <Suspense fallback={<PageLoadingFallback />}>
            <PageTransition><MowerDetails /></PageTransition>
          </Suspense>
        )} 
      />
      <Route component={() => <PageTransition><NotFound /></PageTransition>} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <ThemeProvider defaultTheme="light" storageKey="mower-tracker-theme">
      <QueryClientProvider client={queryClient}>
        <NotificationProvider>
          <TooltipProvider>
            <SidebarProvider style={style as React.CSSProperties}>
              <div className="flex h-screen w-full bg-panel">
                <AppSidebar />
                <div className="flex flex-col flex-1">
                  <header className="flex items-center justify-between p-4 border-b border-panel-border bg-panel shadow-card">
                    <div className="flex items-center gap-4">
                      <SidebarTrigger data-testid="button-sidebar-toggle" />
                      <div className="hidden md:block">
                        <h2 className="text-lg font-semibold text-text-primary">MowerM8</h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="hidden md:flex items-center gap-2 text-sm text-text-muted">
                        <span>Welcome back, John Doe</span>
                      </div>
                      <NotificationDropdown />
                      <ThemeToggle />
                    </div>
                  </header>
                  <main className="flex-1 overflow-auto p-6 bg-calendar-bg">
                    <Router />
                  </main>
                </div>
              </div>
              <VersionDisplay />
            </SidebarProvider>
            <Toaster />
          </TooltipProvider>
        </NotificationProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
