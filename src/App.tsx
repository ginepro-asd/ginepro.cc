import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import EventsList from "./pages/EventsList";
import EventPage from "./pages/EventPage";
import Conferma from "./pages/Conferma";

import NotFound from "./pages/NotFound";
import Guidelines from "./pages/Guidelines";
import MemberCard from "./pages/MemberCard";
import AreaRiservataLogin from "./pages/AreaRiservataLogin";
import AreaRiservataSetup from "./pages/AreaRiservataSetup";
import AreaRiservataDashboard from "./pages/AreaRiservataDashboard";
import NewsletterLanding from "./pages/NewsletterLanding";
import AdminLayout from "./components/AdminLayout";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminHome from "./pages/admin/AdminHome";
import AdminEvents from "./pages/admin/AdminEvents";
import AdminEventDetail from "./pages/admin/AdminEventDetail";
import AdminEventParticipants from "./pages/admin/AdminEventParticipants";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminUserDetail from "./pages/admin/AdminUserDetail";
import AdminSatispay from "./pages/admin/AdminSatispay";
import AdminCertificates from "./pages/admin/AdminCertificates";
import AdminNewsletters from "./pages/admin/AdminNewsletters";
import AdminEmails from "./pages/admin/AdminEmails";
import AdminImports from "./pages/admin/AdminImports";
import AdminChat from "./pages/admin/AdminChat";
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
            <Route path="/newsletter/:slug" element={<NewsletterLanding />} />

            {/* New admin (Google auth + role) */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminHome />} />
              <Route path="events" element={<AdminEvents />} />
              <Route path="events/new" element={<AdminEventDetail />} />
              <Route path="events/:eventId" element={<AdminEventDetail />} />
              <Route path="events/:eventId/participants" element={<AdminEventParticipants />} />
              <Route path="events/:eventId/emails" element={<AdminEmails />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="users/:userId" element={<AdminUserDetail />} />
              <Route path="satispay" element={<AdminSatispay />} />
              <Route path="certificates" element={<AdminCertificates />} />
              <Route path="newsletters" element={<AdminNewsletters />} />
              <Route path="emails" element={<AdminEmails />} />
              <Route path="imports" element={<AdminImports />} />
              <Route path="chat" element={<AdminChat />} />
            </Route>

            {/* Legacy admin route → redirect to new backoffice */}
            <Route path="/:slug/admin" element={<Navigate to="/admin/events" replace />} />

            <Route path="/:slug" element={<EventPage />} />
            <Route path="/:slug/conferma" element={<Conferma />} />
            <Route path="/conferma" element={<Conferma />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
