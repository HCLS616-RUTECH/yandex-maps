import { NgIf } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { debounceTime, Subject } from 'rxjs';
import { IZone } from '../../../../../../models/interfaces/zone.interface';
import { TActionState } from '../../../../../../models/types/action-state.type';
import { SHIFT_ANIMATION } from '../../../../../../shared/animations/shift.animation';

@UntilDestroy()
@Component({
  selector: 'app-selected-params',
  standalone: true,
  imports: [FormsModule, NgIf],
  templateUrl: './selected-params.component.html',
  styleUrl: './selected-params.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [SHIFT_ANIMATION],
})
export class SelectedParamsComponent {
  @Input() params!: IZone;
  @Input() action!: TActionState;

  @Output() onChangeParams = new EventEmitter<Partial<IZone>>();

  private readonly _emitter$ = new Subject<Partial<IZone>>();

  constructor() {
    this._emitter$
      .pipe(untilDestroyed(this), debounceTime(300))
      .subscribe({ next: (params) => this.onChangeParams.emit(params) });
  }

  class =
    'h-10 min-h-10 w-full border-white-1000 border-x border-b flex justify-center items-center p-2 relative overflow-hidden';

  id = Math.floor(Math.random() * 900000000) + 100000000;

  emit(params: Partial<IZone>): void {
    this._emitter$.next(params);
  }
}
