import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';

export const VERTICAL_ANIMATION = trigger('vertical', [
  state('void', style({ height: 0, opacity: 0 })),
  state('*', style({ height: '*', opacity: 1 })),
  transition('* <=> void', animate('100ms ease-in')),
]);
