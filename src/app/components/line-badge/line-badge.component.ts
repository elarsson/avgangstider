import {
  ChangeDetectionStrategy,
  Component,
  input,
} from '@angular/core';

@Component({
  selector: 'app-line-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [attr.data-line]="line()">{{ line() }}</span>`,
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2.4rem;
      padding: 0.15rem 0.35rem;
      border-radius: 4px;
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: 0.02em;
      background: var(--line-default-bg, #7b3f9e);
      color: var(--line-default-fg, #fff);
      white-space: nowrap;
    }
  `,
})
export class LineBadgeComponent {
  line = input.required<string>();
}
