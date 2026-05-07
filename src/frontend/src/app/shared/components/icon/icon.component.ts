import { Component, Input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [LucideAngularModule],
  template: `<lucide-angular
    [name]="name"
    [size]="size"
    [color]="color"
    [strokeWidth]="strokeWidth"
    [attr.aria-label]="ariaLabel"
    [attr.aria-hidden]="ariaHidden"
  />`,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }
    `,
  ],
})
export class IconComponent {
  @Input() name!: string;
  @Input() size: number = 24;
  @Input() color: string = 'currentColor';
  @Input() strokeWidth: number = 2;
  @Input() ariaLabel?: string;
  @Input() ariaHidden: boolean = true;
}
