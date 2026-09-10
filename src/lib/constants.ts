export const VIT_EMAIL_DOMAINS = ["vitstudent.ac.in", "vit.ac.in"];

export const REG_NUMBER_REGEX = /^2[0-6][A-Z]{3}[0-9]{4}$/;

export function isVitEmail(email: string | null | undefined): boolean {
  return !!email && /^[^@\s]+@(vitstudent\.ac\.in|vit\.ac\.in)$/i.test(email.trim());
}
