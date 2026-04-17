import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Departure,
  DepartureRow,
  StopGroup,
  StopLocation,
} from '../models/stop.model';
import { GeolocationService } from './geolocation.service';
import { ResrobotService, RawStop } from './resrobot.service';

@Injectable({ providedIn: 'root' })
export class StopsService {
  private geo = inject(GeolocationService);
  private api = inject(ResrobotService);

  readonly stopGroups = signal<StopGroup[]>([]);
  readonly currentGroupIndex = signal(0);
  readonly currentLocationIndex = signal(0);
  readonly loadingStops = signal(false);
  readonly loadingDepartures = signal(false);
  readonly error = signal<string | null>(null);
  readonly currentTime = signal(new Date());
  readonly searchResults = signal<RawStop[]>([]);
  readonly searching = signal(false);

  private departuresCache = new Map<
    string,
    { deps: Departure[]; loadedAt: number }
  >();
  private cacheVersion = signal(0);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  readonly currentGroup = computed(() => {
    const groups = this.stopGroups();
    return groups[this.currentGroupIndex()] ?? null;
  });

  readonly currentLocation = computed((): StopLocation | null => {
    const group = this.currentGroup();
    if (!group) return null;
    return group.locations[this.currentLocationIndex()] ?? null;
  });

  readonly departureRows = computed((): DepartureRow[] => {
    this.cacheVersion(); // reactive dependency
    const loc = this.currentLocation();
    const now = this.currentTime();
    if (!loc) return [];
    const cached = this.departuresCache.get(loc.extId);
    return buildDepartureRows(cached?.deps ?? [], now);
  });

  init(): void {
    this.loadingStops.set(true);
    this.geo.getPosition().subscribe({
      next: pos =>
        this.loadNearbyStops(pos.coords.latitude, pos.coords.longitude),
      error: (err: unknown) => {
        this.loadingStops.set(false);
        this.error.set(geolocationErrorMessage(err));
      },
    });

    this.refreshTimer = setInterval(() => {
      this.currentTime.set(new Date());
      this.refreshCurrentDepartures();
    }, 30000);
  }

  navigateGroup(delta: number): void {
    const groups = this.stopGroups();
    if (groups.length === 0) return;
    const next =
      ((this.currentGroupIndex() + delta) % groups.length + groups.length) %
      groups.length;
    this.currentGroupIndex.set(next);
    this.currentLocationIndex.set(0);
    this.loadDeparturesIfNeeded();
  }

  navigateLocation(delta: number): void {
    const group = this.currentGroup();
    if (!group) return;
    const count = group.locations.length;
    const next =
      ((this.currentLocationIndex() + delta) % count + count) % count;
    this.currentLocationIndex.set(next);
    this.loadDeparturesIfNeeded();
  }

  search(query: string): void {
    if (!query.trim()) {
      this.searchResults.set([]);
      return;
    }
    this.searching.set(true);
    this.api.searchByName(query).subscribe({
      next: results => {
        this.searchResults.set(results);
        this.searching.set(false);
      },
      error: () => this.searching.set(false),
    });
  }

  selectStop(stop: RawStop): void {
    this.error.set(null);
    this.searchResults.set([]);
    this.loadingStops.set(true);
    this.loadNearbyStops(stop.lat, stop.lon);
  }

  loadDeparturesIfNeeded(): void {
    const loc = this.currentLocation();
    if (!loc) return;
    const cached = this.departuresCache.get(loc.extId);
    const stale = !cached || Date.now() - cached.loadedAt > 25000;
    if (stale) this.loadDepartures(loc.extId);
  }

  private loadNearbyStops(lat: number, lon: number): void {
    this.api.getNearbyStops(lat, lon).subscribe({
      next: stops => {
        const groups = groupStops(stops).slice(0, 5);
        this.stopGroups.set(groups);
        this.loadingStops.set(false);
        this.loadDeparturesIfNeeded();
      },
      error: () => {
        this.loadingStops.set(false);
        this.error.set('Kunde inte ladda hållplatser. Kontrollera anslutningen.');
      },
    });
  }

  private refreshCurrentDepartures(): void {
    const loc = this.currentLocation();
    if (loc) this.loadDepartures(loc.extId);
  }

  private loadDepartures(extId: string): void {
    this.loadingDepartures.set(true);
    this.api.getDepartures(extId).subscribe({
      next: deps => {
        this.departuresCache.set(extId, { deps, loadedAt: Date.now() });
        this.cacheVersion.update(v => v + 1);
        this.currentTime.set(new Date());
        this.loadingDepartures.set(false);
      },
      error: () => {
        this.loadingDepartures.set(false);
      },
    });
  }
}

function groupStops(stops: RawStop[]): StopGroup[] {
  const seen = new Set<string>();
  const groups = new Map<string, StopGroup>();

  for (const stop of stops) {
    if (seen.has(stop.extId)) continue;
    seen.add(stop.extId);

    const { baseName, positionLabel } = parseStopName(stop.name);
    const location: StopLocation = {
      extId: stop.extId,
      name: stop.name,
      positionLabel,
      lat: stop.lat,
      lon: stop.lon,
      dist: stop.dist,
    };

    const existing = groups.get(baseName);
    if (existing) {
      existing.locations.push(location);
      existing.dist = Math.min(existing.dist, stop.dist);
    } else {
      groups.set(baseName, {
        name: baseName,
        locations: [location],
        dist: stop.dist,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => a.dist - b.dist);
}

function parseStopName(name: string): {
  baseName: string;
  positionLabel: string;
} {
  const match = name.match(
    /^(.+?),?\s+(Läge\s+\S+|Spår\s+\S+|Platform\s+\S+|Hållplats\s+\S+)$/i,
  );
  if (match) {
    return { baseName: match[1].trim(), positionLabel: match[2].trim() };
  }
  return { baseName: name, positionLabel: '' };
}

function buildDepartureRows(deps: Departure[], now: Date): DepartureRow[] {
  const groups = new Map<
    string,
    {
      line: string;
      destination: string;
      via: string | null;
      transportCategory: string;
      times: Array<{ minutes: number; time: string }>;
    }
  >();

  for (const dep of deps) {
    const minutes = minutesUntil(dep.date, dep.time, now);
    if (minutes < -1) continue;

    const { destination, via } = parseDirection(dep.direction);
    const key = `${dep.line}|${dep.direction}`;

    if (!groups.has(key)) {
      groups.set(key, {
        line: dep.line,
        destination,
        via,
        transportCategory: dep.transportCategory,
        times: [],
      });
    }
    groups
      .get(key)!
      .times.push({ minutes, time: dep.time.slice(0, 5) });
  }

  const rows: DepartureRow[] = [];
  for (const g of groups.values()) {
    g.times.sort((a, b) => a.minutes - b.minutes);
    const [first, second] = g.times;
    rows.push({
      line: g.line,
      destination: g.destination,
      via: g.via,
      transportCategory: g.transportCategory,
      nextMinutes: first?.minutes ?? 0,
      nextTime: first?.time ?? '',
      afterMinutes: second?.minutes ?? null,
      afterTime: second?.time ?? null,
    });
  }

  return rows.sort((a, b) => a.nextMinutes - b.nextMinutes);
}

function parseDirection(direction: string): {
  destination: string;
  via: string | null;
} {
  const cleaned = direction.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const match = cleaned.match(/^(.+?)\s+via\s+(.+)$/i);
  if (match) {
    return {
      destination: match[1].trim(),
      via: `via ${match[2].trim()}`,
    };
  }
  return { destination: cleaned, via: null };
}

function geolocationErrorMessage(err: unknown): string {
  if (err instanceof GeolocationPositionError) {
    if (err.code === GeolocationPositionError.PERMISSION_DENIED)
      return 'Platsåtkomst nekad. Tillåt platsbehörighet i webbläsaren och ladda om.';
    if (err.code === GeolocationPositionError.POSITION_UNAVAILABLE)
      return 'Din position kunde inte fastställas. Kontrollera GPS/nätverket.';
    if (err.code === GeolocationPositionError.TIMEOUT)
      return 'Tidsgräns för platshämtning överskreds. Försök igen.';
  }
  return `Okänt platsfel: ${String(err)}`;
}

function minutesUntil(date: string, time: string, now: Date): number {
  if (!date || !time) return 999;
  const [y, m, d] = date.split('-').map(Number);
  const parts = time.split(':').map(Number);
  const departure = new Date(y, m - 1, d, parts[0], parts[1], parts[2] ?? 0);
  return Math.floor((departure.getTime() - now.getTime()) / 60000);
}
