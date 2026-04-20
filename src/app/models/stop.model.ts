export interface StopGroup {
  name: string;
  extIds: string[]; // all ResRobot stop-point IDs for this named stop
  dist: number;
}

export interface StopPlatform {
  designation: string; // e.g. "A", "B", ""
  label: string;       // e.g. "Läge A", or "" when no designation
}

export interface Departure {
  tripId: string;
  line: string;
  direction: string;
  scheduledTime: Date;
  effectiveTime: Date; // realtime ?? scheduled
  delayMinutes: number | null; // null = no realtime data
  platform: string;
  canceled: boolean;
  operator: string;
  mode: string;
}

export interface DepartureRow {
  line: string;
  operator: string;
  mode: string;
  destination: string;
  via: string | null;
  nextMinutes: number;
  nextTime: string; // HH:mm
  nextDelay: number | null;
  afterMinutes: number | null;
  afterTime: string | null;
  afterDelay: number | null;
}
