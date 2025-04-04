import { NgSwitch, NgSwitchCase } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TActionState } from '../../../../../../models/types/action-state.type';
import { SHIFT_ANIMATION } from '../../../../../../shared/animations/shift.animation';

@Component({
  selector: 'app-action',
  standalone: true,
  imports: [NgSwitch, NgSwitchCase],
  templateUrl: './action.component.html',
  styleUrl: './action.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [SHIFT_ANIMATION],
})
export class ActionComponent {
  @Input() action!: TActionState;

  sharedClasses =
    'flex items-center justify-center whitespace-nowrap w-full h-full min-h-10 absolute';
}
