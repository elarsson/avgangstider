import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Departure } from '../models/stop.model';

const API_KEY = 'bf4d6ed259a84967aecdcfc0d8bef2be';
const BASE = 'https://realtime-api.trafiklab.se/v1';

interface TimetableEntry {
  scheduled: string;
  realtime?: string;
  is_realtime?: boolean;
  canceled?: boolean;
  route?: { designation?: string; direction?: string; agency?: { name?: string; id?: string } };
  trip?: { trip_id?: string; operator?: { name?: string; id?: string } };
  realtime_platform?: { designation?: string };
  scheduled_platform?: { designation?: string };
  agency?: { name?: string; id?: string };
  operator?: { name?: string; id?: string };
}

interface DeparturesResponse {
  departures?: TimetableEntry[];
}

@Injectable({ providedIn: 'root' })
export class TrafiklabService {
  private http = inject(HttpClient);

  getDepartures(stopId: string): Observable<Departure[]> {
    return this.http
      .get<DeparturesResponse>(`${BASE}/departures/${stopId}`, {
        params: { key: API_KEY },
      })
      .pipe(map(r => (r.departures ?? []).map(mapEntry)));
  }
}

function mapEntry(d: TimetableEntry): Departure {
  const platform =
    d.realtime_platform?.designation ??
    d.scheduled_platform?.designation ??
    '';
  const scheduled = new Date(d.scheduled);
  const realtime = d.realtime ? new Date(d.realtime) : null;
  const effectiveTime = d.is_realtime && realtime ? realtime : scheduled;
  const operator =
    d.operator?.name ??
    d.agency?.name ??
    d.route?.agency?.name ??
    d.trip?.operator?.name ??
    '';
  return {
    tripId: d.trip?.trip_id ?? `${d.scheduled}|${d.route?.designation ?? ''}`,
    line: d.route?.designation ?? '',
    direction: d.route?.direction ?? '',
    effectiveTime,
    platform,
    canceled: d.canceled ?? false,
    operator,
  };
}
