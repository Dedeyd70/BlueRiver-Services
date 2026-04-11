import { useState } from "react";
import { motion } from "framer-motion";

interface BeforeAfterPair {
  id: string;
  before_image_url: string;
  after_image_url: string;
  caption?: string;
}

interface BeforeAfterContainerProps {
  pairs: BeforeAfterPair[];
  onImageClick?: (url: string) => void;
}

const BeforeAfterSlider = ({ pair }: { pair: BeforeAfterPair }) => {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);

  const handleMove = (clientX: number, rect: DOMRect) => {
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSliderPos((x / rect.width) * 100);
  };

  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-card">
      <div
        className="relative w-full h-64 md:h-80 select-none cursor-col-resize"
        onMouseDown={() => setIsDragging(true)}
        onMouseUp={() => setIsDragging(false)}
        onMouseLeave={() => setIsDragging(false)}
        onMouseMove={(e) => isDragging && handleMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onTouchMove={(e) => handleMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
      >
        {/* After (background) */}
        <img src={pair.after_image_url} alt="After" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        {/* Before (clipped) */}
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${sliderPos}%` }}>
          <img src={pair.before_image_url} alt="Before" className="absolute inset-0 w-full h-full object-cover" style={{ minWidth: `${100 / (sliderPos / 100)}%`, maxWidth: "none", width: `${100 / (sliderPos / 100)}%` }} loading="lazy" />
        </div>
        {/* Slider handle */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg" style={{ left: `${sliderPos}%` }}>
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 3L2 8L5 13M11 3L14 8L11 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-foreground" /></svg>
          </div>
        </div>
        {/* Labels */}
        <span className="absolute bottom-2 left-2 bg-foreground/70 text-background text-xs font-semibold px-2 py-0.5 rounded">Before</span>
        <span className="absolute bottom-2 right-2 bg-primary text-primary-foreground text-xs font-semibold px-2 py-0.5 rounded">After</span>
      </div>
      {pair.caption && (
        <div className="p-3">
          <p className="text-sm text-muted-foreground">{pair.caption}</p>
        </div>
      )}
    </div>
  );
};

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const BeforeAfterContainer = ({ pairs }: BeforeAfterContainerProps) => {
  if (!pairs.length) return null;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {pairs.map((pair, i) => (
        <motion.div key={pair.id} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }}>
          <BeforeAfterSlider pair={pair} />
        </motion.div>
      ))}
    </div>
  );
};

export default BeforeAfterContainer;
