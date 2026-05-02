import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-unit-select',
  standalone: true,
  imports: [FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UnitSelectComponent),
      multi: true
    }
  ],
  template: `
    <select
      [id]="selectId"
      [(ngModel)]="value"
      (ngModelChange)="onChange($event)"
      (blur)="onTouched()"
      [disabled]="disabled"
      class="unit-select"
      [attr.aria-label]="label"
    >
      @for (opt of options; track opt.value) {
        <option [value]="opt.value">{{ opt.label }}</option>
      }
    </select>
  `,
  styles: [`
    .unit-select {
      height: 48px;
      padding: 0 var(--space-3);
      background: var(--color-bg-tertiary);
      border: 1px solid var(--color-border);
      border-radius: var(--border-radius-md);
      color: var(--color-text-primary);
      font-size: var(--font-size-body);
      font-family: var(--font-family-body);
      cursor: pointer;
      min-width: 80px;

      &:focus {
        outline: none;
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px rgba(217, 119, 54, 0.2);
      }
    }
  `]
})
export class UnitSelectComponent implements ControlValueAccessor {
  @Input() label: string = 'Unit';

  value: string = 'ml';
  selectId = 'unit-' + Math.random().toString(36).slice(2, 9);

  readonly options = [
    { value: 'ml', label: 'ml' },
    { value: 'oz', label: 'oz' },
    { value: 'count', label: 'count' },
    { value: 'g', label: 'g' }
  ];

  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string): void {
    if (value) this.value = value;
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  disabled: boolean = false;
}
