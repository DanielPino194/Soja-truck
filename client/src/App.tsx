import { useState } from "react";
import { Router, Route, Switch } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { Sidebar } from "./components/Sidebar";
import { Overview } from "./pages/Overview";
import { Correlation } from "./pages/Correlation";
import { Spread } from "./pages/Spread";
import { Shocks } from "./pages/Shocks";
import { Alerts } from "./pages/Alerts";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <div className="flex h-screen overflow-hidden bg-background">
          <Sidebar />
          <main className="flex-1 overflow-y-auto overscroll-contain">
            <Switch>
              <Route path="/" component={Overview} />
              <Route path="/correlacion" component={Correlation} />
              <Route path="/brecha" component={Spread} />
              <Route path="/shocks" component={Shocks} />
              <Route path="/alertas" component={Alerts} />
            </Switch>
          </main>
        </div>
        <Toaster />
      </Router>
    </QueryClientProvider>
  );
}
