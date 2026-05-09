const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const US_PHONE_RE = /^\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}$/;

export const isValidEmail = (email: string): boolean => EMAIL_RE.test(email.trim());

export const isValidUSPhone = (phone: string): boolean => US_PHONE_RE.test(phone.trim().replace(/\s+/g, ""));
