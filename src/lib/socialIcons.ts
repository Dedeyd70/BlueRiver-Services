import {
  FacebookIcon as Facebook,
  InstagramIcon as Instagram,
  TwitterIcon as Twitter,
  YoutubeIcon as Youtube,
  LinkedinIcon as Linkedin,
  GithubIcon as Github,
  TwitchIcon as Twitch,
  Music2Icon as Music2,
  SendIcon as Send,
  MessageCircleIcon as MessageCircle,
  RssIcon as Rss,
  GlobeIcon as Globe,
  LinkIcon,
  type LucideIcon,
} from "lucide-react";

/** Normalize platform name: trim, lowercase, strip all whitespace. */
export const normalizePlatform = (raw: string): string =>
  (raw ?? "").toLowerCase().replace(/\s+/g, "").trim();

const ICONS: Record<string, LucideIcon> = {
  facebook: Facebook,
  fb: Facebook,
  instagram: Instagram,
  ig: Instagram,
  insta: Instagram,
  twitter: Twitter,
  x: Twitter,
  youtube: Youtube,
  yt: Youtube,
  linkedin: Linkedin,
  github: Github,
  gh: Github,
  twitch: Twitch,
  tiktok: Music2,
  spotify: Music2,
  soundcloud: Music2,
  telegram: Send,
  whatsapp: MessageCircle,
  messenger: MessageCircle,
  discord: MessageCircle,
  threads: MessageCircle,
  rss: Rss,
  blog: Rss,
  website: Globe,
  web: Globe,
};

/** Resolve a Lucide icon for a platform name, falling back to Link. */
export const getSocialIcon = (platformName: string): LucideIcon => {
  const key = normalizePlatform(platformName);
  return ICONS[key] ?? LinkIcon;
};

/** Returns the canonical match label, or null if no match. */
export const getMatchedPlatformLabel = (platformName: string): string | null => {
  const key = normalizePlatform(platformName);
  if (!key) return null;
  if (!ICONS[key]) return null;
  return key.charAt(0).toUpperCase() + key.slice(1);
};
