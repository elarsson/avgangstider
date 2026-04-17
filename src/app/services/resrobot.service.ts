import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Departure } from '../models/stop.model';

const ACCESS_ID = 'eb156387-37a5-4cfd-8e44-6d67047a568a';
const BASE = 'https://api.resrobot.se/v2.1';

export interface RawStop {
  extId: string;
  name: string;
  lat: number;
  lon: number;
  dist: number;
}

interface NearbyResponse {
  stopLocationOrCoordLocation?: Array<{
    StopLocation?: {
      extId: string;
      name: string;
      lon: number;
      lat: number;
      dist?: number;
    };
  }>;
}

interface ApiProduct {
  line?: string;
  displayNumber?: string;
  num?: string;
  catOut?: string;
}

interface DepartureBoardResponse {
  Departure?: Array<{
    Product?: ApiProduct | ApiProduct[];
    name?: string;
    transportCategory?: string;
    time?: string;
    date?: string;
    direction?: string;
  }>;
}

@Injectable({ providedIn: 'root' })
export class ResrobotService {
  private http = inject(HttpClient);

  getNearbyStops(lat: number, lon: number): Observable<RawStop[]> {
    const params = new HttpParams()
      .set('originCoordLat', lat)
      .set('originCoordLong', lon)
      .set('maxNo', 50)
      .set('r', 1000)
      .set('format', 'json')
      .set('accessId', ACCESS_ID);

    return this.http
      .get<NearbyResponse>(`${BASE}/location.nearbystops`, { params })
      .pipe(
        map(r =>
          (r.stopLocationOrCoordLocation ?? [])
            .map(e => e.StopLocation)
            .filter((s): s is NonNullable<typeof s> => s != null)
            .map(s => ({
              extId: s.extId,
              name: s.name,
              lon: s.lon,
              lat: s.lat,
              dist: s.dist ?? 0,
            })),
        ),
      );
  }

  searchByName(query: string): Observable<RawStop[]> {
    const params = new HttpParams()
      .set('input', query)
      .set('maxNo', 8)
      .set('format', 'json')
      .set('accessId', ACCESS_ID);

    return this.http
      .get<NearbyResponse>(`${BASE}/location.name`, { params })
      .pipe(
        map(r =>
          (r.stopLocationOrCoordLocation ?? [])
            .map(e => e.StopLocation)
            .filter((s): s is NonNullable<typeof s> => s != null)
            .map(s => ({
              extId: s.extId,
              name: s.name,
              lon: s.lon,
              lat: s.lat,
              dist: 0,
            })),
        ),
      );
  }

  getDepartures(extId: string): Observable<Departure[]> {
    const params = new HttpParams()
      .set('id', extId)
      .set('maxJourneys', 40)
      .set('duration', 90)
      .set('format', 'json')
      .set('accessId', ACCESS_ID);

    return this.http
      .get<DepartureBoardResponse>(`${BASE}/departureBoard`, { params })
      .pipe(
        map(r =>
          (r.Departure ?? []).map(d => {
            const product = Array.isArray(d.Product) ? d.Product[0] : d.Product;
            return {
              line:
                product?.line ??
                product?.displayNumber ??
                product?.num ??
                '',
              direction: d.direction ?? '',
              time: d.time ?? '',
              date: d.date ?? '',
              transportCategory: d.transportCategory ?? '',
            };
          }),
        ),
      );
  }
}
