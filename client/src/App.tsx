import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Suspense, lazy } from "react";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy load large/non-critical pages for better performance
const MowerDetails = lazy(() => import("@/pages/MowerDetails"));
const AddServiceRecord = lazy(() => import("@/pages/AddServiceRecord"));
const EditServiceRecord = lazy(() => import("@/pages/EditServiceRecord"));

// Keep critical pages as regular imports for fast initial load
import Dashboard from "@/pages/Dashboard";
import MowerList from "@/pages/MowerList";
import AddMower from "@/pages/AddMower";
import EditMower from "@/pages/EditMower";
import NotFound from "@/pages/not-found";

// Loading fallback component
function PageLoadingFallback() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/mowers" component={MowerList} />
      <Route path="/mowers/new" component={AddMower} />
      <Route path="/mowers/:id/edit" component={EditMower} />
      <Route 
        path="/mowers/:id/service/new" 
        component={() => (
          <Suspense fallback={<PageLoadingFallback />}>
            <AddServiceRecord />
          </Suspense>
        )} 
      />
      <Route 
        path="/mowers/:id/service/:serviceId/edit" 
        component={() => (
          <Suspense fallback={<PageLoadingFallback />}>
            <EditServiceRecord />
          </Suspense>
        )} 
      />
      <Route 
        path="/mowers/:id" 
        component={() => (
          <Suspense fallback={<PageLoadingFallback />}>
            <MowerDetails />
          </Suspense>
        )} 
      />
      <Route component={NotFound} />
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
        <TooltipProvider>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1">
                <header className="flex items-center justify-between p-4 border-b bg-background">
                  <div className="flex items-center gap-4">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <div className="hidden md:block">
                      <h2 className="text-lg font-semibold">Mower Manager</h2>
                    </div>
                  </div>
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-auto p-6">
                  <Router />
                </main>
              </div>
            </div>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
