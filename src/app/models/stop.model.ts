export interface StopLocation {
  extId: string;
  name: string;
  positionLabel: string;
  lat: number;
  lon: number;
  dist: number;
}

export interface StopGroup {
  name: string;
  locations: StopLocation[];
  dist: number;
}

export interface Departure {
  line: string;
  direction: string;
  time: string; // HH:mm:ss
  date: string; // YYYY-MM-DD
  transportCategory: string;
}

export interface DepartureRow {
  line: string;
  destination: string;
  via: string | null;
  transportCategory: string;
  nextMinutes: number;
  nextTime: string; // HH:mm
  afterMinutes: number | null;
  afterTime: string | null;
}
