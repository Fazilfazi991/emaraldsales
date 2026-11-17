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

/** Summarize saved duty/rest timestamps by Dubai business day. */
export function summarizeDutyDays(
  sessions: Array<Record<string, any>>,
  rests: Array<Record<string, any>>,
  from: string,
  to: string,
  now = Date.now(),
) {
  const out: Array<{ day: string; personId: string; name: string; dutyMinutes: number; breakMinutes: number; netMinutes: number; sessions: number }> = [];
  const days: string[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  const owners = new Map<string, { name: string; sessions: Array<Record<string, any>> }>();
  for (const session of sessions) {
    const id = String(session.executive_id);
    const owner = owners.get(id) ?? { name: String(session.name ?? "Staff member"), sessions: [] };
    owner.sessions.push(session);
    owners.set(id, owner);
  }
  const merge = (intervals: Array<[number, number]>) => {
    const sorted = intervals.filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [];
    for (const [start, end] of sorted) {
      const last = merged.at(-1);
      if (last && start <= last[1]) last[1] = Math.max(last[1], end);
      else merged.push([start, end]);
    }
    return merged;
  };
  const total = (intervals: Array<[number, number]>) => intervals.reduce((sum, [a, b]) => sum + b - a, 0);
  for (const day of days) {
    const [rangeStart, rangeEnd] = dayRange(day, day).map((value) => +new Date(value));
    for (const [personId, owner] of owners) {
      const dutyIntervals: Array<[number, number]> = [];
      const breakIntervals: Array<[number, number]> = [];
      let count = 0;
      for (const session of owner.sessions) {
        const start = +new Date(session.started_at);
        const rawEnd = session.ended_at ? +new Date(session.ended_at) : now;
        const end = Math.min(rawEnd, now, rangeEnd);
        const clippedStart = Math.max(start, rangeStart);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end <= clippedStart) continue;
        count++;
        dutyIntervals.push([clippedStart, end]);
        const sessionRests = session.rests ?? rests.filter((rest) => rest.session_id === session.id);
        for (const rest of sessionRests) {
          const restStart = +new Date(rest.started_at);
          const restEnd = Math.min(rest.ended_at ? +new Date(rest.ended_at) : now, now, end, rangeEnd);
          const a = Math.max(restStart, clippedStart);
          if (Number.isFinite(a) && Number.isFinite(restEnd) && restEnd > a) breakIntervals.push([a, restEnd]);
        }
      }
      if (!count) continue;
      const dutyMs = total(merge(dutyIntervals));
      const breakMs = Math.min(dutyMs, total(merge(breakIntervals)));
      out.push({ day, personId, name: owner.name, dutyMinutes: Math.floor(dutyMs / 60000), breakMinutes: Math.floor(breakMs / 60000), netMinutes: Math.floor(Math.max(0, dutyMs - breakMs) / 60000), sessions: count });
    }
  }
  return out;
}
