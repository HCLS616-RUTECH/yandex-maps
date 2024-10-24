import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';

export const ROTATE_ANIMATION = trigger('rotate', [
  state('false', style({ transform: 'rotate(0deg)' })),
  state('true', style({ transform: 'rotate(180deg)' })),
  transition('false <=> true', animate('120ms ease-in')),
]);
