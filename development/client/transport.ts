/** The normal CRM always uses its authenticated server. Only the isolated demo build substitutes this module. */
export interface DemoControls {
  profiles: {id: string; name: string; role: string}[];
  select: (id: string) => void;
  reset: () => void;
  download: (path: string) => Promise<void>;
  dutyNow: () => {sessions: Record<string, any>[]; rests: Record<string, any>[]; today?: Record<string, any>};
  formatDuration: (ms: number) => string;
  currentDay: () => string;
}
export function getDemoControls(): DemoControls | undefined { return undefined; }
export function request(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`/api${path}`, init);
}
