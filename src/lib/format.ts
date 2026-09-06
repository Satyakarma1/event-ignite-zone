export function fmtDate(d: string | null | undefined) {
  if (!d) return "TBA";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(d: string | null | undefined) {
  if (!d) return "TBA";
  return new Date(d).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtFee(fee: number) {
  if (!fee) return "Free";
  return `₹${fee}`;
}

export function isPast(d: string | null | undefined, fallback?: string | null) {
  const end = d ?? fallback;
  if (!end) return false;
  return new Date(end).getTime() < Date.now();
}

export function daysUntil(d: string) {
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}
