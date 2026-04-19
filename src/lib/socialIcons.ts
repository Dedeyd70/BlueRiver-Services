import {
  FaFacebook,
  FaInstagram,
  FaXTwitter,
  FaYoutube,
  FaLinkedin,
  FaGithub,
  FaTwitch,
  FaTiktok,
  FaSpotify,
  FaSoundcloud,
  FaTelegram,
  FaWhatsapp,
  FaFacebookMessenger,
  FaDiscord,
  FaThreads,
  FaPinterest,
  FaSnapchat,
  FaReddit,
  FaMedium,
  FaRss,
  FaGlobe,
  FaLink,
} from "react-icons/fa6";
import type { IconType } from "react-icons";

/** Normalize platform name: lowercase, strip ALL whitespace. Handles "Facebook ", "FACEBOOK", "Face Book". */
export const normalizePlatform = (raw: string): string =>
  (raw ?? "").toLowerCase().replace(/\s+/g, "").trim();

const ICONS: Record<string, { icon: IconType; label: string }> = {
  facebook: { icon: FaFacebook, label: "Facebook" },
  fb: { icon: FaFacebook, label: "Facebook" },
  instagram: { icon: FaInstagram, label: "Instagram" },
  ig: { icon: FaInstagram, label: "Instagram" },
  insta: { icon: FaInstagram, label: "Instagram" },
  twitter: { icon: FaXTwitter, label: "X / Twitter" },
  x: { icon: FaXTwitter, label: "X / Twitter" },
  youtube: { icon: FaYoutube, label: "YouTube" },
  yt: { icon: FaYoutube, label: "YouTube" },
  linkedin: { icon: FaLinkedin, label: "LinkedIn" },
  github: { icon: FaGithub, label: "GitHub" },
  gh: { icon: FaGithub, label: "GitHub" },
  twitch: { icon: FaTwitch, label: "Twitch" },
  tiktok: { icon: FaTiktok, label: "TikTok" },
  spotify: { icon: FaSpotify, label: "Spotify" },
  soundcloud: { icon: FaSoundcloud, label: "SoundCloud" },
  telegram: { icon: FaTelegram, label: "Telegram" },
  whatsapp: { icon: FaWhatsapp, label: "WhatsApp" },
  messenger: { icon: FaFacebookMessenger, label: "Messenger" },
  discord: { icon: FaDiscord, label: "Discord" },
  threads: { icon: FaThreads, label: "Threads" },
  pinterest: { icon: FaPinterest, label: "Pinterest" },
  snapchat: { icon: FaSnapchat, label: "Snapchat" },
  reddit: { icon: FaReddit, label: "Reddit" },
  medium: { icon: FaMedium, label: "Medium" },
  rss: { icon: FaRss, label: "RSS" },
  blog: { icon: FaRss, label: "Blog" },
  website: { icon: FaGlobe, label: "Website" },
  web: { icon: FaGlobe, label: "Website" },
};

/** Resolve a brand icon for a platform name, falling back to a generic Link icon. */
export const getSocialIcon = (platformName: string): IconType => {
  const key = normalizePlatform(platformName);
  return ICONS[key]?.icon ?? FaLink;
};

/** Returns a friendly matched label, or null if no match. */
export const getMatchedPlatformLabel = (platformName: string): string | null => {
  const key = normalizePlatform(platformName);
  if (!key) return null;
  return ICONS[key]?.label ?? null;
};
