const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const US_PHONE_RE = /^\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}$/;
const ZIP_RE = /^\d{5}$/;

export const isValidEmail = (email: string): boolean => EMAIL_RE.test(email.trim());

export const isValidUSPhone = (phone: string): boolean => US_PHONE_RE.test(phone.trim().replace(/\s+/g, ""));

export const isValidZip = (zip: string): boolean => ZIP_RE.test(zip.trim());
