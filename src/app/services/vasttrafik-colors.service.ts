import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';

export interface LineColors {
  backgroundColor?: string;
  foregroundColor?: string;
  borderColor?: string;
}

@Injectable({ providedIn: 'root' })
export class VasttrafikColorsService {
  private http = inject(HttpClient);
  private colors = signal<Record<string, LineColors>>({});

  load(): void {
    this.http
      .get<Record<string, LineColors>>('vasttrafik-colors.json')
      .pipe(catchError(() => of({} as Record<string, LineColors>)))
      .subscribe(data => this.colors.set(data));
  }

  getColors(designation: string): LineColors | null {
    return this.colors()[designation] ?? null;
  }
}
