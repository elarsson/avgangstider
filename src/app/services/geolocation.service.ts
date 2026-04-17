import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  getPosition(): Observable<GeolocationPosition> {
    return new Observable(observer => {
      if (!navigator.geolocation) {
        observer.error('Geolocation not supported');
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => {
          observer.next(pos);
          observer.complete();
        },
        err => observer.error(err),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
      );
    });
  }
}
