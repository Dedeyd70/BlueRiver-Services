import { useState, useEffect } from "react";
import PageMeta from "@/components/PageMeta";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import BeforeAfterContainer from "@/components/BeforeAfterContainer";
import SectionHeading from "@/components/SectionHeading";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const Gallery = () => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");

  const { data: services } = useQuery({
    queryKey: ["public-services-gallery"],
    queryFn: async () => {
      const { data } = await supabase.from("services").select("title").eq("is_active", true).order("display_order");
      return data ?? [];
    },
  });

  const { data: images } = useQuery({
    queryKey: ["public-gallery"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gallery")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      return data ?? [];
    },
  });

  const categories = ["All", ...new Set((services ?? []).map((s) => s.title))];

  // Separate standalone vs grouped
  const allImages = images ?? [];
  const standalone = allImages.filter((img) => img.image_type === "single" || !img.group_id);
  const grouped = allImages.filter((img) => img.group_id && img.image_type !== "single");

  // Build before/after pairs
  const groupMap: Record<string, { before?: typeof allImages[0]; after?: typeof allImages[0]; caption?: string }> = {};
  grouped.forEach((item) => {
    if (!item.group_id) return;
    if (!groupMap[item.group_id]) groupMap[item.group_id] = {};
    if (item.image_type === "before") groupMap[item.group_id].before = item;
    if (item.image_type === "after") groupMap[item.group_id].after = item;
    if (item.caption) groupMap[item.group_id].caption = item.caption;
  });

  const baPairs = Object.entries(groupMap)
    .filter(([, g]) => g.before && g.after)
    .map(([id, g]) => ({
      id,
      before_image_url: g.before!.image_url,
      after_image_url: g.after!.image_url,
      caption: g.caption || "",
      category: g.before!.category || "",
    }));

  const filteredStandalone = activeCategory === "All" ? standalone : standalone.filter((img) => img.category === activeCategory);
  const filteredBA = activeCategory === "All" ? baPairs : baPairs.filter((p) => p.category === activeCategory);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (selectedIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedIndex(null);
      if (e.key === "ArrowRight" && selectedIndex < filteredStandalone.length - 1) setSelectedIndex(selectedIndex + 1);
      if (e.key === "ArrowLeft" && selectedIndex > 0) setSelectedIndex(selectedIndex - 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIndex, filteredStandalone.length]);

  return (
    <div>
      <PageMeta title="Gallery" description="See examples of our professional cleaning results. Before and after transformations and portfolio images." />
      <section className="pt-32 pb-16 md:pt-40 md:pb-20 bg-muted/50">
        <div className="container">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="max-w-2xl mx-auto text-center">
            <span className="inline-block px-4 py-1.5 rounded-full bg-sky text-sky-foreground text-xs font-semibold tracking-wider uppercase mb-4">Our Work</span>
            <h1 className="text-4xl md:text-5xl font-display font-extrabold text-foreground mb-4">Gallery</h1>
            <p className="text-muted-foreground leading-relaxed">See examples of our professional cleaning results.</p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="container">
          {/* Category Filter Bar */}
          <div className="flex flex-wrap gap-2 mb-8 justify-center">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeCategory === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Before/After Section */}
          {filteredBA.length > 0 && (
            <div className="mb-12">
              <SectionHeading badge="Transformations" title="Before & After" description="Drag the slider to see the difference." />
              <BeforeAfterContainer pairs={filteredBA} />
            </div>
          )}

          {/* Standalone Gallery */}
          {!filteredStandalone.length && !filteredBA.length ? (
            <p className="text-center text-muted-foreground">No images in this category yet.</p>
          ) : filteredStandalone.length > 0 ? (
            <>
              {filteredBA.length > 0 && (
                <SectionHeading badge="Portfolio" title="Gallery" description="Browse our work." />
              )}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredStandalone.map((img, i) => (
                  <motion.div
                    key={img.id}
                    {...fadeUp}
                    transition={{ duration: 0.5, delay: i * 0.05 }}
                    className="cursor-pointer group rounded-2xl overflow-hidden border border-border"
                    onClick={() => setSelectedIndex(i)}
                  >
                    <div className="relative">
                      <img
                        src={img.image_url}
                        alt={img.caption || "Gallery image"}
                        className="w-full h-48 md:h-56 object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {img.caption && (
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                          <p className="text-white text-xs">{img.caption}</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </section>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedIndex !== null && filteredStandalone[selectedIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedIndex(null)}
          >
            <button className="absolute top-4 right-4 text-white z-10" onClick={() => setSelectedIndex(null)}>
              <X className="w-8 h-8" />
            </button>
            {selectedIndex > 0 && (
              <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white z-10" onClick={(e) => { e.stopPropagation(); setSelectedIndex(selectedIndex - 1); }}>
                <ChevronLeft className="w-10 h-10" />
              </button>
            )}
            {selectedIndex < filteredStandalone.length - 1 && (
              <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 hover:text-white z-10" onClick={(e) => { e.stopPropagation(); setSelectedIndex(selectedIndex + 1); }}>
                <ChevronRight className="w-10 h-10" />
              </button>
            )}
            <motion.div
              key={selectedIndex}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="max-w-full max-h-[90vh] flex flex-col items-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={filteredStandalone[selectedIndex].image_url}
                alt={filteredStandalone[selectedIndex].caption || "Gallery preview"}
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
              {filteredStandalone[selectedIndex].caption && (
                <p className="text-white/80 text-sm mt-3 text-center">{filteredStandalone[selectedIndex].caption}</p>
              )}
              <p className="text-white/50 text-xs mt-1">{selectedIndex + 1} / {filteredStandalone.length}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Gallery;
