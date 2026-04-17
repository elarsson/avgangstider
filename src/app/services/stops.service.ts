import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  Departure,
  DepartureRow,
  StopGroup,
  StopPlatform,
} from '../models/stop.model';
import { GeolocationService } from './geolocation.service';
import { ResrobotService, RawStop } from './resrobot.service';
import { TrafiklabService } from './trafiklab.service';

interface PlatformCache {
  platforms: StopPlatform[];
  depsByPlatform: Map<string, Departure[]>;
  loadedAt: number;
}

@Injectable({ providedIn: 'root' })
export class StopsService {
  private geo = inject(GeolocationService);
  private resrobot = inject(ResrobotService);
  private trafiklab = inject(TrafiklabService);

  readonly stopGroups = signal<StopGroup[]>([]);
  readonly currentGroupIndex = signal(0);
  readonly currentPlatformIndex = signal(0);
  readonly loadingStops = signal(true);
  readonly loadingDepartures = signal(false);
  readonly error = signal<string | null>(null);
  readonly currentTime = signal(new Date());
  readonly searchResults = signal<RawStop[]>([]);
  readonly searching = signal(false);

  private platformCache = new Map<string, PlatformCache>();
  private cacheVersion = signal(0);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  readonly currentGroup = computed(
    () => this.stopGroups()[this.currentGroupIndex()] ?? null,
  );

  readonly currentPlatforms = computed((): StopPlatform[] => {
    this.cacheVersion();
    const group = this.currentGroup();
    return this.platformCache.get(group?.name ?? '')?.platforms ?? [];
  });

  readonly currentPlatform = computed((): StopPlatform | null => {
    const platforms = this.currentPlatforms();
    return platforms[this.currentPlatformIndex()] ?? null;
  });

  readonly departureRows = computed((): DepartureRow[] => {
    this.cacheVersion();
    const group = this.currentGroup();
    const platform = this.currentPlatform();
    const now = this.currentTime();
    if (!group || !platform) return [];
    const deps =
      this.platformCache
        .get(group.name)
        ?.depsByPlatform.get(platform.designation) ?? [];
    return buildDepartureRows(deps, now);
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
    this.currentPlatformIndex.set(0);
    this.loadDeparturesIfNeeded();
  }

  navigateLocation(delta: number): void {
    const platforms = this.currentPlatforms();
    if (platforms.length === 0) return;
    const next =
      ((this.currentPlatformIndex() + delta) % platforms.length +
        platforms.length) %
      platforms.length;
    this.currentPlatformIndex.set(next);
  }

  search(query: string): void {
    if (!query.trim()) {
      this.searchResults.set([]);
      return;
    }
    this.searching.set(true);
    this.resrobot.searchByName(query).subscribe({
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
    const group = this.currentGroup();
    if (!group) return;
    const cached = this.platformCache.get(group.name);
    const stale = !cached || Date.now() - cached.loadedAt > 25000;
    if (stale) this.loadDepartures(group);
  }

  private loadNearbyStops(lat: number, lon: number): void {
    this.resrobot.getNearbyStops(lat, lon).subscribe({
      next: stops => {
        const groups = groupStops(stops).slice(0, 5);
        this.stopGroups.set(groups);
        this.currentGroupIndex.set(0);
        this.currentPlatformIndex.set(0);
        this.loadingStops.set(false);
        this.loadDeparturesIfNeeded();
      },
      error: () => {
        this.loadingStops.set(false);
        this.error.set(
          'Kunde inte ladda hållplatser. Kontrollera anslutningen.',
        );
      },
    });
  }

  private refreshCurrentDepartures(): void {
    const group = this.currentGroup();
    if (group) this.loadDepartures(group);
  }

  private loadDepartures(group: StopGroup): void {
    this.loadingDepartures.set(true);
    const calls = group.extIds.map(id =>
      this.trafiklab
        .getDepartures(id)
        .pipe(catchError(() => of([] as Departure[]))),
    );
    forkJoin(calls).subscribe({
      next: results => {
        const merged = deduplicateDepartures(results.flat());
        const { platforms, depsByPlatform } = splitByPlatform(merged);
        this.platformCache.set(group.name, {
          platforms,
          depsByPlatform,
          loadedAt: Date.now(),
        });
        const count = platforms.length;
        if (this.currentPlatformIndex() >= count) {
          this.currentPlatformIndex.set(Math.max(0, count - 1));
        }
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
    const baseName = parseBaseName(stop.name);
    const existing = groups.get(baseName);
    if (existing) {
      existing.extIds.push(stop.extId);
      existing.dist = Math.min(existing.dist, stop.dist);
    } else {
      groups.set(baseName, {
        name: baseName,
        extIds: [stop.extId],
        dist: stop.dist,
      });
    }
  }

  return Array.from(groups.values()).sort((a, b) => a.dist - b.dist);
}

function parseBaseName(name: string): string {
  const match = name.match(
    /^(.+?),?\s+(Läge\s+\S+|Spår\s+\S+|Platform\s+\S+|Hållplats\s+\S+)$/i,
  );
  return match ? match[1].trim() : name;
}

function deduplicateDepartures(deps: Departure[]): Departure[] {
  const seen = new Set<string>();
  return deps.filter(d => {
    if (seen.has(d.tripId)) return false;
    seen.add(d.tripId);
    return true;
  });
}

function splitByPlatform(deps: Departure[]): {
  platforms: StopPlatform[];
  depsByPlatform: Map<string, Departure[]>;
} {
  const byPlatform = new Map<string, Departure[]>();
  for (const dep of deps) {
    if (dep.canceled) continue;
    if (!byPlatform.has(dep.platform)) byPlatform.set(dep.platform, []);
    byPlatform.get(dep.platform)!.push(dep);
  }

  const platforms: StopPlatform[] = Array.from(byPlatform.keys())
    .sort((a, b) => {
      if (a === '' && b !== '') return 1;
      if (b === '' && a !== '') return -1;
      return a.localeCompare(b);
    })
    .map(designation => ({
      designation,
      label: designation ? platformLabel(designation) : '',
    }));

  return { platforms, depsByPlatform: byPlatform };
}

function platformLabel(designation: string): string {
  return /^[A-Z]$/i.test(designation)
    ? `Läge ${designation.toUpperCase()}`
    : designation;
}

function buildDepartureRows(deps: Departure[], now: Date): DepartureRow[] {
  const groups = new Map<
    string,
    {
      line: string;
      destination: string;
      via: string | null;
      times: Array<{ minutes: number; time: string }>;
    }
  >();

  for (const dep of deps) {
    const minutes = minutesUntil(dep.effectiveTime, now);
    if (minutes < -1) continue;
    const { destination, via } = parseDirection(dep.direction);
    const key = `${dep.line}|${dep.direction}`;
    if (!groups.has(key)) {
      groups.set(key, { line: dep.line, destination, via, times: [] });
    }
    groups.get(key)!.times.push({ minutes, time: formatHHMM(dep.effectiveTime) });
  }

  const rows: DepartureRow[] = [];
  for (const g of groups.values()) {
    g.times.sort((a, b) => a.minutes - b.minutes);
    const [first, second] = g.times;
    rows.push({
      line: g.line,
      destination: g.destination,
      via: g.via,
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
  if (match)
    return { destination: match[1].trim(), via: `via ${match[2].trim()}` };
  return { destination: cleaned, via: null };
}

function minutesUntil(time: Date, now: Date): number {
  return Math.floor((time.getTime() - now.getTime()) / 60000);
}

function formatHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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
