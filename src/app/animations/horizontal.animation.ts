import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';

export const HORIZONTAL_ANIMATION = trigger('horizontal', [
  state('void', style({ width: 0 })),
  state('*', style({ width: '*' })),
  transition('* <=> void', animate('120ms ease-in')),
]);
