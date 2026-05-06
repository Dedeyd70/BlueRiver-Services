import { useSiteSettings } from "@/hooks/useSiteSettings";

const LocalBusinessSchema = () => {
  const { data: settings } = useSiteSettings();

  const schema = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: settings?.company_name || "BlueRiver Services",
    description: settings?.hero_subheadline || "Professional residential and commercial cleaning services in Washington State.",
    telephone: settings?.phone || "(206) 317-8300",
    email: settings?.email || "info@blueriverservices.co",
    areaServed: {
      "@type": "State",
      name: "Washington",
      containedInPlace: { "@type": "Country", name: "US" },
    },
    address: {
      "@type": "PostalAddress",
      addressRegion: "WA",
      addressCountry: "US",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "07:00",
        closes: "19:00",
      },
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: "Saturday",
        opens: "08:00",
        closes: "17:00",
      },
    ],
    priceRange: "$$",
    url: typeof window !== "undefined" ? window.location.origin : "",
  };

  // Static, server-defined schema only — no user-fetched data is interpolated.
  return (
    <script type="application/ld+json">
      {JSON.stringify(schema)}
    </script>
  );
};

export default LocalBusinessSchema;
