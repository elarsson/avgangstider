import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { DepartureRow } from '../../models/stop.model';
import { LineBadgeComponent } from '../line-badge/line-badge.component';

@Component({
  selector: 'app-departure-board',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LineBadgeComponent],
  templateUrl: './departure-board.component.html',
  styleUrl: './departure-board.component.css',
})
export class DepartureBoardComponent {
  rows = input.required<DepartureRow[]>();
  loading = input(false);
  stopName = input('');
  platformLabel = input('');
  currentTime = input(new Date());

  protected formatTime(minutes: number, time: string): string {
    if (minutes <= 0) return 'Nu';
    if (minutes < 60) return String(minutes);
    return time; // HH:mm
  }

  protected showUnit(minutes: number): boolean {
    return minutes > 0 && minutes < 60;
  }

  protected formattedClock(): string {
    const d = this.currentTime();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  protected headerLabel(): string {
    const plat = this.platformLabel();
    return plat ? `${this.stopName()}, ${plat}` : this.stopName();
  }
}
