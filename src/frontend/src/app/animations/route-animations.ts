import { animate, query, style, transition, trigger, group } from '@angular/animations';

const slideIn = [
  style({ position: 'fixed', width: '100%', transform: 'translateX(30px)', opacity: 0 }),
  animate('0.3s ease-out', style({ transform: 'translateX(0)', opacity: 1 })),
];

const slideOut = [
  style({ position: 'fixed', width: '100%', transform: 'translateX(0)', opacity: 1 }),
  animate('0.2s ease-in', style({ transform: 'translateX(-30px)', opacity: 0 })),
];

export const routeAnimations = trigger('routeAnimations', [
  transition('* => *', [
    group([
      query(':enter', slideIn, { optional: true }),
      query(':leave', slideOut, { optional: true }),
    ]),
  ]),
]);
