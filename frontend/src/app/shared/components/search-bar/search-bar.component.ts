import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-search-bar',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="search-bar">
      <svg class="search-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <input
        type="text"
        class="search-input"
        [placeholder]="placeholder"
        [(ngModel)]="query"
        (input)="onInput()"
        [disabled]="disabled"
        aria-label="Search cocktails"
      />
      @if (query) {
        <button class="search-clear" (click)="clear()" aria-label="Clear search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      }
    </div>
  `,
  styles: [`
    .search-bar {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: var(--space-3);
      top: 50%;
      transform: translateY(-50%);
      color: var(--color-text-tertiary);
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      height: 48px;
      padding: 0 var(--space-10) 0 var(--space-10);
      background: var(--color-bg-tertiary);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-md);
      color: var(--color-text-primary);
      font-size: var(--font-size-body);
      font-family: var(--font-family-body);
      transition: border-color var(--transition-fast);

      &::placeholder {
        color: var(--color-text-tertiary);
      }

      &:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px rgba(217, 119, 54, 0.2);
      }
    }

    .search-clear {
      position: absolute;
      right: var(--space-2);
      top: 50%;
      transform: translateY(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      color: var(--color-text-tertiary);
      border-radius: var(--border-radius-full);

      &:hover {
        background: var(--color-bg-tertiary);
        color: var(--color-text-primary);
      }
    }
  `]
})
export class SearchBarComponent {
  @Input() placeholder: string = 'Search cocktails...';
  @Input() disabled: boolean = false;
  @Output() search = new EventEmitter<string>();
  @Output() cleared = new EventEmitter<void>();

  query: string = '';

  onInput(): void {
    this.search.emit(this.query);
  }

  clear(): void {
    this.query = '';
    this.search.emit('');
    this.cleared.emit();
  }
}
