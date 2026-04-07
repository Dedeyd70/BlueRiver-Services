import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ScrollToTop from "@/components/ScrollToTop";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Index from "./pages/Index";
import About from "./pages/About";
import Services from "./pages/Services";
import Gallery from "./pages/Gallery";
import Contact from "./pages/Contact";
import BookService from "./pages/BookService";
import RequestQuote from "./pages/RequestQuote";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/Login";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Submissions from "./pages/admin/Submissions";
import ServicesAdmin from "./pages/admin/ServicesAdmin";
import GalleryAdmin from "./pages/admin/GalleryAdmin";
import TestimonialsAdmin from "./pages/admin/TestimonialsAdmin";
import SettingsAdmin from "./pages/admin/SettingsAdmin";
import PaymentSettingsAdmin from "./pages/admin/PaymentSettingsAdmin";
import AccountSettings from "./pages/admin/AccountSettings";
import ResetPassword from "./pages/admin/ResetPassword";
import PrivacyPolicyAdmin from "./pages/admin/PrivacyPolicyAdmin";
import BookingsAdmin from "./pages/admin/BookingsAdmin";
import QuotesAdmin from "./pages/admin/QuotesAdmin";
import AvailabilityAdmin from "./pages/admin/AvailabilityAdmin";
import TermsAdmin from "./pages/admin/TermsAdmin";
import BeforeAfterAdmin from "./pages/admin/BeforeAfterAdmin";
import BrandingAdmin from "./pages/admin/BrandingAdmin";
import UserManagement from "./pages/admin/UserManagement";
import HomepageImagesAdmin from "./pages/admin/HomepageImagesAdmin";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Routes>
            {/* Admin routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="submissions" element={<Submissions />} />
              <Route path="services" element={<ServicesAdmin />} />
              <Route path="gallery" element={<GalleryAdmin />} />
              <Route path="before-after" element={<BeforeAfterAdmin />} />
              <Route path="testimonials" element={<TestimonialsAdmin />} />
              <Route path="payment" element={<PaymentSettingsAdmin />} />
              <Route path="settings" element={<SettingsAdmin />} />
              <Route path="account" element={<AccountSettings />} />
              <Route path="privacy-policy" element={<PrivacyPolicyAdmin />} />
              <Route path="bookings" element={<BookingsAdmin />} />
              <Route path="quotes" element={<QuotesAdmin />} />
              <Route path="availability" element={<AvailabilityAdmin />} />
              <Route path="terms" element={<TermsAdmin />} />
              <Route path="branding" element={<BrandingAdmin />} />
              <Route path="homepage-images" element={<HomepageImagesAdmin />} />
              <Route path="users" element={<UserManagement />} />
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
                      <Route path="/gallery" element={<Gallery />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/book" element={<BookService />} />
                      <Route path="/quote" element={<RequestQuote />} />
                      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                      <Route path="/terms-of-service" element={<TermsOfService />} />
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
