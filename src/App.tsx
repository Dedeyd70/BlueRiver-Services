import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Index from "./pages/Index";
import About from "./pages/About";
import Services from "./pages/Services";
import Contact from "./pages/Contact";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/Login";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Submissions from "./pages/admin/Submissions";
import ServicesAdmin from "./pages/admin/ServicesAdmin";
import TestimonialsAdmin from "./pages/admin/TestimonialsAdmin";
import SettingsAdmin from "./pages/admin/SettingsAdmin";
import AccountSettings from "./pages/admin/AccountSettings";
import ResetPassword from "./pages/admin/ResetPassword";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Admin routes — no Navbar/Footer */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="submissions" element={<Submissions />} />
              <Route path="services" element={<ServicesAdmin />} />
              <Route path="testimonials" element={<TestimonialsAdmin />} />
              <Route path="settings" element={<SettingsAdmin />} />
              <Route path="account" element={<AccountSettings />} />
            </Route>

            {/* Public routes */}
            <Route
              path="*"
              element={
                <>
                  <Navbar />
                  <main>
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/services" element={<Services />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </main>
                  <Footer />
                </>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
