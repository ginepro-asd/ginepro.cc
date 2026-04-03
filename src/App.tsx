import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import EventsList from "./pages/EventsList";
import EventPage from "./pages/EventPage";
import Conferma from "./pages/Conferma";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import Guidelines from "./pages/Guidelines";
import MemberCard from "./pages/MemberCard";
import AreaRiservataLogin from "./pages/AreaRiservataLogin";
import AreaRiservataSetup from "./pages/AreaRiservataSetup";
import AreaRiservataDashboard from "./pages/AreaRiservataDashboard";
import NewsletterLanding from "./pages/NewsletterLanding";
import EmailUnsubscribe from "./pages/EmailUnsubscribe";
import { ThemeProvider } from "./components/theme-provider";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<EventsList />} />
            <Route path="/guidelines" element={<Guidelines />} />
            <Route path="/card/:id" element={<MemberCard />} />
            <Route path="/area-riservata" element={<AreaRiservataLogin />} />
            <Route path="/area-riservata/setup" element={<AreaRiservataSetup />} />
            <Route path="/area-riservata/dashboard" element={<AreaRiservataDashboard />} />
            <Route path="/unsubscribe" element={<EmailUnsubscribe />} />
            <Route path="/newsletter/:slug" element={<NewsletterLanding />} />
            <Route path="/:slug" element={<EventPage />} />
            <Route path="/:slug/conferma" element={<Conferma />} />
            <Route path="/:slug/admin" element={<Admin />} />
            {/* Legacy routes for backward compatibility */}
            <Route path="/conferma" element={<Conferma />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
