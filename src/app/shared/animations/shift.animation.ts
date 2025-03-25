import { animate, style, transition, trigger } from '@angular/animations';

export const SHIFT_ANIMATION = trigger('shift', [
  transition('void => *', [
    style({ top: '-40px', opacity: 0 }),
    animate('150ms ease-in', style({ top: '0', opacity: 1 })),
  ]),
  transition('* => void', [
    animate('150ms ease-in', style({ top: '40px', opacity: 0 })),
  ]),
]);
