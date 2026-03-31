import { Link } from "react-router-dom";
import { Droplets, Phone, Mail, MapPin } from "lucide-react";

const Footer = () => (
  <footer className="bg-navy text-navy-foreground">
    <div className="container py-16">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
        {/* Brand */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-hero-gradient flex items-center justify-center">
              <Droplets className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-lg font-display font-bold">BlueRiver</span>
          </div>
          <p className="text-sm text-navy-foreground/70 leading-relaxed">
            Professional cleaning services for homes and businesses across the United States. Trusted by thousands.
          </p>
          <div className="flex gap-3">
            {[Facebook, Instagram, Twitter].map((Icon, i) => (
              <a key={i} href="#" className="w-9 h-9 rounded-full bg-navy-foreground/10 flex items-center justify-center hover:bg-primary transition-colors">
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="font-display font-semibold mb-4">Quick Links</h4>
          <div className="flex flex-col gap-2">
            {[["Home", "/"], ["About Us", "/about"], ["Services", "/services"], ["Contact", "/contact"]].map(([label, path]) => (
              <Link key={path} to={path} className="text-sm text-navy-foreground/70 hover:text-primary transition-colors">{label}</Link>
            ))}
          </div>
        </div>

        {/* Services */}
        <div>
          <h4 className="font-display font-semibold mb-4">Services</h4>
          <div className="flex flex-col gap-2">
            {["Residential Cleaning", "Commercial Cleaning", "Deep Cleaning", "Move-in/Move-out"].map((s) => (
              <Link key={s} to="/services" className="text-sm text-navy-foreground/70 hover:text-primary transition-colors">{s}</Link>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div>
          <h4 className="font-display font-semibold mb-4">Contact Us</h4>
          <div className="flex flex-col gap-3">
            <a href="tel:+18005551234" className="flex items-center gap-2 text-sm text-navy-foreground/70 hover:text-primary transition-colors">
              <Phone className="w-4 h-4" /> (800) 555-1234
            </a>
            <a href="mailto:info@blueriverservices.com" className="flex items-center gap-2 text-sm text-navy-foreground/70 hover:text-primary transition-colors">
              <Mail className="w-4 h-4" /> info@blueriverservices.com
            </a>
            <span className="flex items-center gap-2 text-sm text-navy-foreground/70">
              <MapPin className="w-4 h-4" /> Serving the United States
            </span>
          </div>
        </div>
      </div>

      <div className="mt-12 pt-8 border-t border-navy-foreground/10 text-center text-sm text-navy-foreground/50">
        © {new Date().getFullYear()} BlueRiver Services. All rights reserved.
      </div>
    </div>
  </footer>
);

export default Footer;
