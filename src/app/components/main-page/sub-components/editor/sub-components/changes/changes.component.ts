import { NgForOf, NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  Input,
  Output,
  signal,
} from '@angular/core';
import { MChangedParam } from '../../../../../../models/maps/changed-param.map';
import { TChangedParam } from '../../../../../../models/types/changed-param.type';
import { ROTATE_ANIMATION } from '../../../../../../shared/animations/rotate.animation';
import { VERTICAL_ANIMATION } from '../../../../../../shared/animations/vertical.animation';

@Component({
  selector: 'app-changes',
  imports: [NgIf, NgForOf],
  standalone: true,
  templateUrl: './changes.component.html',
  styleUrl: './changes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [VERTICAL_ANIMATION, ROTATE_ANIMATION],
})
export class ChangesComponent {
  @Input() changes: TChangedParam[] = [];

  @Output() onClearParams = new EventEmitter<TChangedParam[]>();

  isShowChanges = computed(() => this._open() && !!this.changes.length);

  class =
    'w-full border-white-1000 border-x border-b flex justify-between items-center p-2 overflow-hidden';

  MChangedParam = MChangedParam;

  private readonly _open = signal<boolean>(false);

  toggle(): void {
    this._open.set(!this._open());
  }
}
