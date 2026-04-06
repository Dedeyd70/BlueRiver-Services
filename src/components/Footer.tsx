import { Link } from "react-router-dom";
import { Phone, Mail, MapPin } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/blueriver-logo.png";

const Footer = () => {
  const { data: settings } = useSiteSettings();
  const { data: services } = useQuery({
    queryKey: ["public-services-footer"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("title").eq("is_active", true).order("display_order").limit(4);
      return data ?? [];
    },
  });

  const phone = settings?.phone || "(409) 977-1515";
  const phoneLink = settings?.phone_link || "+14099771515";
  const email = settings?.email || "joshuaquao@gmail.com";
  const serviceArea = settings?.service_area || "Serving Washington and surrounding areas";
  const tagline = settings?.footer_tagline || "Professional cleaning services for homes and businesses. Trusted by our community.";

  const handleHomeClick = (e: React.MouseEvent) => {
    if (window.location.pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <footer className="bg-navy text-navy-foreground">
      <div className="container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <img src={logo} alt="BlueRiver Services" className="h-10 w-auto object-contain brightness-0 invert" />
            </div>
            <p className="text-sm text-navy-foreground/70 leading-relaxed">{tagline}</p>
          </div>

          <div>
            <h4 className="font-display font-semibold mb-4">Quick Links</h4>
            <div className="flex flex-col gap-2">
              {[["Home", "/"], ["About Us", "/about"], ["Services", "/services"], ["Gallery", "/gallery"], ["Book Now", "/book"], ["Request a Quote", "/quote"], ["Admin", "/admin/login"]].map(([label, path]) => (
                <Link
                  key={path}
                  to={path}
                  onClick={path === "/" ? handleHomeClick : undefined}
                  className="text-sm text-navy-foreground/70 hover:text-primary transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-display font-semibold mb-4">Services</h4>
            <div className="flex flex-col gap-2">
              {(services ?? []).map((s) => (
                <Link key={s.title} to="/services" className="text-sm text-navy-foreground/70 hover:text-primary transition-colors">{s.title}</Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-display font-semibold mb-4">Contact Us</h4>
            <div className="flex flex-col gap-3">
              <a href={`tel:${phoneLink}`} className="flex items-center gap-2 text-sm text-navy-foreground/70 hover:text-primary transition-colors">
                <Phone className="w-4 h-4" /> {phone}
              </a>
              <a href={`mailto:${email}`} className="flex items-center gap-2 text-sm text-navy-foreground/70 hover:text-primary transition-colors">
                <Mail className="w-4 h-4" /> {email}
              </a>
              <span className="flex items-center gap-2 text-sm text-navy-foreground/70">
                <MapPin className="w-4 h-4" /> {serviceArea}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-navy-foreground/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-navy-foreground/50">
          <span>© {new Date().getFullYear()} BlueRiver Services. All rights reserved.</span>
          <div className="flex gap-4">
            <Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/terms-of-service" className="hover:text-primary transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
