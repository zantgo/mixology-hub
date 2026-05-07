import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="input-wrapper">
      @if (label) {
        <label [for]="inputId" class="input-label">{{ label }}</label>
      }
      <div class="input-container" [class.has-error]="!!error">
        <input
          [id]="inputId"
          [type]="type"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [attr.aria-required]="required"
          [attr.aria-describedby]="error ? errorId : hint ? hintId : null"
          [attr.aria-invalid]="!!error"
          [(ngModel)]="value"
          (input)="onInput($event)"
          (blur)="onTouched()"
          class="form-input"
        />
        @if (error) {
          <span class="error-icon" aria-hidden="true">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
        }
      </div>
      @if (error) {
        <p [id]="errorId" class="form-error visible" role="alert">{{ error }}</p>
      }
      @if (hint && !error) {
        <p [id]="hintId" class="form-hint">{{ hint }}</p>
      }
    </div>
  `,
  styles: [
    `
      .input-wrapper {
        margin-bottom: var(--space-4);
      }

      .input-label {
        display: block;
        font-size: var(--font-size-body-small);
        font-weight: var(--font-weight-medium);
        color: var(--color-text-secondary);
        margin-bottom: var(--space-2);
      }

      .input-container {
        position: relative;
      }

      .input-container.has-error input {
        border-color: var(--color-error);
      }

      .input-container input {
        padding-right: 2.5rem;
      }

      .error-icon {
        position: absolute;
        right: var(--space-3);
        top: 50%;
        transform: translateY(-50%);
        color: var(--color-error);
        display: flex;
      }

      .form-error {
        color: var(--color-error);
        font-size: var(--font-size-caption);
        margin-top: var(--space-1);
        overflow: hidden;
      }

      .form-error.visible {
        max-height: 100px;
      }

      .form-hint {
        color: var(--color-text-tertiary);
        font-size: var(--font-size-caption);
        margin-top: var(--space-1);
      }
    `,
  ],
})
export class InputComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() type: string = 'text';
  @Input() placeholder: string = '';
  @Input() error: string = '';
  @Input() hint?: string;
  @Input() required: boolean = false;
  @Input() disabled: boolean = false;

  value: string = '';
  inputId = 'input-' + Math.random().toString(36).slice(2, 9);
  errorId = this.inputId + '-error';
  hintId = this.inputId + '-hint';

  onChange: (value: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(value: string): void {
    this.value = value || '';
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

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.onChange(input.value);
  }
}
