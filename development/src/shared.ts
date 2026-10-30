/** Browser-safe vocabulary and UAE date helpers. No database or validation imports. */
export type Role = "executive" | "manager" | "admin" | "delivery";
export interface Actor {
  id: string;
  name: string;
  role: Role;
  organizationId: string;
}
export const outcomes = [
  "Regular Visit",
  "Follow-up Required",
  "Order Expected",
  "Order Received",
  "Not Interested",
  "Customer Not Available",
  "Closed",
  "New Opportunity",
] as const;
export const orderStates = [
  "No Order",
  "Order Expected",
  "Order Received",
] as const;
export const shopStatuses = [
  "Customer",
  "New Lead",
  "Contacted",
  "Interested",
  "Not Interested",
] as const;
export const businessDay = (instant: Date | string): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(instant));
export function addDays(day: string, count: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + count);
  return d.toISOString().slice(0, 10);
}
export function dayRange(from: string, to: string) {
  return [`${from}T00:00:00+04:00`, `${addDays(to, 1)}T00:00:00+04:00`];
}
