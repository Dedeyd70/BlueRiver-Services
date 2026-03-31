import { motion } from "framer-motion";

interface Props {
  badge?: string;
  title: string;
  description?: string;
  center?: boolean;
}

const SectionHeading = ({ badge, title, description, center = true }: Props) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.5 }}
    className={`max-w-2xl mb-12 ${center ? "mx-auto text-center" : ""}`}
  >
    {badge && (
      <span className="inline-block px-4 py-1.5 rounded-full bg-sky text-sky-foreground text-xs font-semibold tracking-wider uppercase mb-4">
        {badge}
      </span>
    )}
    <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">{title}</h2>
    {description && <p className="text-muted-foreground leading-relaxed">{description}</p>}
  </motion.div>
);

export default SectionHeading;
