import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-icon',
  standalone: true,
  template: `<lucide-angular
    [name]="name"
    [size]="size"
    [color]="color"
    [strokeWidth]="strokeWidth"
    [ariaLabel]="ariaLabel"
    [ariaHidden]="ariaHidden"
  />`,
  styles: [`:host { display: inline-flex; align-items: center; justify-content: center; }`]
})
export class IconComponent {
  @Input() name!: string;
  @Input() size: number = 24;
  @Input() color: string = 'currentColor';
  @Input() strokeWidth: number = 2;
  @Input() ariaLabel?: string;
  @Input() ariaHidden: boolean = true;
}
