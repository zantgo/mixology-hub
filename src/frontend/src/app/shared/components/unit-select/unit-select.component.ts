import { Component, forwardRef, Input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

const ALL_UNITS = [
  { value: 'ml', label: 'ml', category: 'volume' },
  { value: 'oz', label: 'oz', category: 'volume' },
  { value: 'cl', label: 'cl', category: 'volume' },
  { value: 'l', label: 'l', category: 'volume' },
  { value: 'tbsp', label: 'tbsp', category: 'volume' },
  { value: 'tsp', label: 'tsp', category: 'volume' },
  { value: 'g', label: 'g', category: 'mass' },
  { value: 'kg', label: 'kg', category: 'mass' },
  { value: 'count', label: 'count', category: 'count' },
];

const VOLUME_UNITS = new Set(['ml', 'oz', 'cl', 'l', 'tbsp', 'tsp']);
const MASS_UNITS = new Set(['g', 'kg']);

@Component({
  selector: 'app-unit-select',
  standalone: true,
  imports: [FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => UnitSelectComponent),
      multi: true,
    },
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
      @for (opt of filteredOptions; track opt.value) {
        <option [value]="opt.value">{{ opt.label }}</option>
      }
    </select>
  `,
  styles: [
    `
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
    `,
  ],
})
export class UnitSelectComponent implements ControlValueAccessor {
  @Input() label: string = 'Unit';
  @Input() baseUnit?: string;
  @Input() allowMassVolumeConversion?: boolean;

  value: string = 'ml';
  selectId = 'unit-' + Math.random().toString(36).slice(2, 9);

  get filteredOptions() {
    if (!this.baseUnit || this.allowMassVolumeConversion) {
      return ALL_UNITS;
    }
    const baseLower = this.baseUnit.toLowerCase();
    if (VOLUME_UNITS.has(baseLower)) {
      return ALL_UNITS.filter((u) => u.category === 'volume' || u.category === 'count');
    }
    if (MASS_UNITS.has(baseLower)) {
      return ALL_UNITS.filter((u) => u.category === 'mass' || u.category === 'count');
    }
    return ALL_UNITS;
  }

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
