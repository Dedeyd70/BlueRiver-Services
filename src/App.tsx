import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ScrollToTop from "@/components/ScrollToTop";
import BackToTop from "@/components/BackToTop";
import PublicLayout from "@/components/PublicLayout";
import Index from "./pages/Index";
import About from "./pages/About";
import Services from "./pages/Services";
import Gallery from "./pages/Gallery";
import Contact from "./pages/Contact";
import BookService from "./pages/BookService";
import RequestQuote from "./pages/RequestQuote";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import LiabilityDisclaimer from "./pages/LiabilityDisclaimer";
import CancellationPolicy from "./pages/CancellationPolicy";
import NotFound from "./pages/NotFound";
import AdminLogin from "./pages/admin/Login";
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import Submissions from "./pages/admin/Submissions";
import ServicesAdmin from "./pages/admin/ServicesAdmin";
import GalleryAdmin from "./pages/admin/GalleryAdmin";
import TestimonialsAdmin from "./pages/admin/TestimonialsAdmin";
import SettingsAdmin from "./pages/admin/SettingsAdmin";
import AccountSettings from "./pages/admin/AccountSettings";
import ResetPassword from "./pages/admin/ResetPassword";
import PrivacyPolicyAdmin from "./pages/admin/PrivacyPolicyAdmin";
import BookingsAdmin from "./pages/admin/BookingsAdmin";
import QuotesAdmin from "./pages/admin/QuotesAdmin";
import TermsAdmin from "./pages/admin/TermsAdmin";
import LegalAdmin from "./pages/admin/LegalAdmin";
import InvoicesAdmin from "./pages/admin/InvoicesAdmin";
import MessagesAdmin from "./pages/admin/MessagesAdmin";
import BrandingAdmin from "./pages/admin/BrandingAdmin";
import UserManagement from "./pages/admin/UserManagement";
import PermissionsAdmin from "./pages/admin/PermissionsAdmin";
import HomepageImagesAdmin from "./pages/admin/HomepageImagesAdmin";
import SiteContentAdmin from "./pages/admin/SiteContentAdmin";
import LeaveReview from "./pages/LeaveReview";
import LocalBusinessSchema from "./components/LocalBusinessSchema";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <LocalBusinessSchema />
          <ScrollToTop />
          <BackToTop />
          <Routes>
            {/* Admin routes */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="submissions" element={<Submissions />} />
              <Route path="services" element={<ServicesAdmin />} />
              <Route path="gallery" element={<GalleryAdmin />} />
              <Route path="testimonials" element={<TestimonialsAdmin />} />
              <Route path="settings" element={<SettingsAdmin />} />
              <Route path="account" element={<AccountSettings />} />
              <Route path="privacy-policy" element={<PrivacyPolicyAdmin />} />
              <Route path="bookings" element={<BookingsAdmin />} />
              <Route path="quotes" element={<QuotesAdmin />} />
              <Route path="messages" element={<MessagesAdmin />} />
              <Route path="terms" element={<TermsAdmin />} />
              <Route path="legal" element={<LegalAdmin />} />
              <Route path="branding" element={<BrandingAdmin />} />
              <Route path="homepage-images" element={<HomepageImagesAdmin />} />
              <Route path="site-content" element={<SiteContentAdmin />} />
              <Route path="users" element={<UserManagement />} />
              <Route path="permissions" element={<PermissionsAdmin />} />
              <Route path="invoices" element={<InvoicesAdmin />} />
              <Route path="availability" element={<SettingsAdmin />} />
              <Route path="payment" element={<SettingsAdmin />} />
            </Route>

            {/* Public routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Index />} />
              <Route path="/about" element={<About />} />
              <Route path="/services" element={<Services />} />
              <Route path="/gallery" element={<Gallery />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/book" element={<BookService />} />
              <Route path="/quote" element={<RequestQuote />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/liability-disclaimer" element={<LiabilityDisclaimer />} />
              <Route path="/cancellation-policy" element={<CancellationPolicy />} />
              <Route path="/review/:bookingId" element={<LeaveReview />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
