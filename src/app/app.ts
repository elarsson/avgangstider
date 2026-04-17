import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DepartureBoardComponent } from './components/departure-board/departure-board.component';
import { StopsService } from './services/stops.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DepartureBoardComponent, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(touchstart)': 'onTouchStart($event)',
    '(touchend)': 'onTouchEnd($event)',
    '(touchcancel)': 'onTouchCancel()',
  },
})
export class App implements OnInit {
  protected stops = inject(StopsService);
  protected searchQuery = '';

  private touchStartX = 0;
  private touchStartY = 0;
  private touchActive = false;

  ngOnInit(): void {
    this.stops.init();
  }

  onTouchStart(event: TouchEvent): void {
    const t = event.touches[0];
    this.touchStartX = t.clientX;
    this.touchStartY = t.clientY;
    this.touchActive = true;
  }

  onTouchEnd(event: TouchEvent): void {
    if (!this.touchActive) return;
    this.touchActive = false;
    const t = event.changedTouches[0];
    const dx = t.clientX - this.touchStartX;
    const dy = t.clientY - this.touchStartY;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (adx < 40 && ady < 40) return;
    if (adx > ady * 1.3) {
      this.stops.navigateLocation(dx < 0 ? 1 : -1);
    } else if (ady > adx * 1.3) {
      this.stops.navigateGroup(dy < 0 ? 1 : -1);
    }
  }

  onTouchCancel(): void {
    this.touchActive = false;
  }

  protected submitSearch(): void {
    const q = this.searchQuery.trim();
    if (q) this.stops.search(q);
  }
}
