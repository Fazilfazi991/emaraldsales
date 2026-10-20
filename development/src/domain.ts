import { z } from "zod";

export type Role = "executive" | "manager" | "admin";
export interface Actor {
  id: string;
  name: string;
  role: Role;
  organizationId: string;
}
export class Fault extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
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
const text = (max: number) => z.string().trim().max(max);
export const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(`${s}T12:00:00Z`);
    return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === s;
  }, "Invalid calendar date");
export const locationInput = z.discriminatedUnion("availability", [
  z
    .object({
      availability: z.literal("captured"),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy: z.number().min(0).max(1000000),
      capturedAt: z.string().datetime(),
    })
    .strict(),
  z
    .object({
      availability: z.enum([
        "denied",
        "unavailable",
        "timeout",
        "not_requested",
      ]),
    })
    .strict(),
]);
export const checkinInput = z
  .object({ shopId: z.string().uuid(), location: locationInput })
  .strict();
export const checkoutInput = z
  .object({
    outcome: z.enum(outcomes),
    notes: text(5000).min(1),
    orderStatus: z.enum(orderStates),
    orderNote: text(1000).default(""),
    orderValue: z
      .number()
      .min(0)
      .max(999999999)
      .multipleOf(0.01)
      .nullable()
      .default(null),
    followUpDate: calendarDate.nullable().default(null),
  })
  .strict();
export const leadInput = z
  .object({
    name: text(160).min(1),
    contact: text(120),
    phone: text(40).regex(/^[+\d ()-]*$/),
    area: text(100).min(1),
    location: text(300),
    notes: text(5000),
    assignedExecutiveId: z.string().uuid(),
    checkIn: z.boolean().default(false),
    gps: locationInput.default({ availability: "not_requested" }),
  })
  .strict();
export const followupInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.enum(["complete", "cancel"]),
      reason: text(1000).min(1),
      version: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      action: z.literal("reschedule"),
      dueDate: calendarDate,
      reason: text(1000).min(1),
      version: z.number().int().positive(),
    })
    .strict(),
]);
export const shopUpdateInput = z.object({
  version: z.number().int().positive(),
  name: text(160).min(1),
  contact: text(120),
  phone: text(40).regex(/^[+\d ()-]*$/),
  area: text(100).min(1),
  location: text(300),
  notes: text(5000),
  reason: text(1000).min(1),
}).strict();
export const shopTransferInput = z.object({
  version: z.number().int().positive(),
  assignedExecutiveId: z.string().uuid(),
  reason: text(1000).min(1),
}).strict();
export const followupCreateInput = z.object({
  visitId: z.string().uuid(),
  dueDate: calendarDate,
}).strict();
export const followupAssignInput = z.object({
  version: z.number().int().positive(),
  ownerId: z.string().uuid(),
  reason: text(1000).min(1),
}).strict();
export type DutyState = "off" | "on" | "rest";
export type DutyAction = "start" | "rest" | "return" | "end";
export function nextDuty(state: DutyState, action: DutyAction): DutyState {
  const transitions: Record<string, DutyState> = {
    "off:start": "on",
    "on:rest": "rest",
    "rest:return": "on",
    "on:end": "off",
  };
  const next = transitions[`${state}:${action}`];
  if (!next)
    throw new Fault(
      409,
      "INVALID_TRANSITION",
      `Cannot ${action} while ${state}. Return from rest before ending duty.`,
    );
  return next;
}
export function executive(actor: Actor) {
  if (actor.role !== "executive")
    throw new Fault(
      403,
      "FORBIDDEN",
      "Only executives can record their own field activity.",
    );
}
export function owns(actor: Actor, ownerId: string) {
  if (actor.id !== ownerId)
    throw new Fault(
      403,
      "FORBIDDEN",
      "This record belongs to another executive.",
    );
}
export function management(actor: Actor) {
  if (actor.role !== "manager" && actor.role !== "admin")
    throw new Fault(403, "FORBIDDEN", "Only managers can make this change.");
}
export function requirePolicy(policy: string, name: string, approved = "approved-v1") {
  if (policy !== approved)
    throw new Fault(
      409,
      "POLICY_PENDING",
      `${name} is unavailable pending approval of the documented business rules.`,
    );
}
