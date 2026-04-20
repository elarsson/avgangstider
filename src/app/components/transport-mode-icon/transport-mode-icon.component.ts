import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-transport-mode-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host { display: contents; }
    svg { display: block; color: #888; }
  `,
  template: `
    @switch (mode().toUpperCase()) {
      @case ('BUS') {
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-label="Buss">
          <rect x="1" y="3" width="14" height="9" rx="2"/>
          <rect x="2" y="4" width="5" height="3" rx="1" fill="#fff" opacity=".6"/>
          <rect x="9" y="4" width="5" height="3" rx="1" fill="#fff" opacity=".6"/>
          <circle cx="4" cy="13.5" r="1.5"/>
          <circle cx="12" cy="13.5" r="1.5"/>
        </svg>
      }
      @case ('TRAM') {
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-label="Spårvagn">
          <line x1="5" y1="1" x2="3" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="11" y1="1" x2="13" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <rect x="1" y="4" width="14" height="8" rx="2"/>
          <rect x="2" y="5" width="5" height="3" rx="1" fill="#fff" opacity=".6"/>
          <rect x="9" y="5" width="5" height="3" rx="1" fill="#fff" opacity=".6"/>
          <circle cx="4" cy="13.5" r="1.5"/>
          <circle cx="12" cy="13.5" r="1.5"/>
        </svg>
      }
      @case ('TRAIN') {
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-label="Tåg">
          <rect x="2" y="1" width="12" height="11" rx="3"/>
          <rect x="3" y="2" width="4" height="3" rx="1" fill="#fff" opacity=".6"/>
          <rect x="9" y="2" width="4" height="3" rx="1" fill="#fff" opacity=".6"/>
          <rect x="1" y="8" width="14" height="2" rx="1"/>
          <circle cx="4.5" cy="13.5" r="1.5"/>
          <circle cx="11.5" cy="13.5" r="1.5"/>
          <line x1="4.5" y1="12" x2="3" y2="15" stroke="currentColor" stroke-width="1.2"/>
          <line x1="11.5" y1="12" x2="13" y2="15" stroke="currentColor" stroke-width="1.2"/>
        </svg>
      }
      @case ('METRO') {
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-label="Tunnelbana">
          <circle cx="8" cy="8" r="7" fill="currentColor"/>
          <text x="8" y="12" text-anchor="middle" font-size="9" font-weight="900" font-family="sans-serif" fill="#fff">M</text>
        </svg>
      }
      @case ('BOAT') {
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-label="Båt">
          <path d="M8 2 L8 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M8 2 L12 6 L8 6 L4 6 Z"/>
          <path d="M1 10 Q4 8 8 10 Q12 12 15 10 L14 13 Q11 15 8 13 Q5 11 2 13 Z"/>
        </svg>
      }
      @case ('TAXI') {
        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-label="Taxi">
          <path d="M3 8 L4 5 L12 5 L13 8"/>
          <rect x="1" y="8" width="14" height="5" rx="2"/>
          <rect x="3" y="6" width="3" height="2" rx="1" fill="#fff" opacity=".6"/>
          <rect x="10" y="6" width="3" height="2" rx="1" fill="#fff" opacity=".6"/>
          <circle cx="4" cy="14" r="1.5"/>
          <circle cx="12" cy="14" r="1.5"/>
          <rect x="6" y="3" width="4" height="2" rx="1"/>
        </svg>
      }
    }
  `,
})
export class TransportModeIconComponent {
  mode = input('');
}
