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
import { SHIFT_ANIMATION } from '../../../../../../animations/shift.animation';
import { ISelectedParams } from '../../../../../../models/interfaces/selected-params.interface';
import { TActionState } from '../../../../../../models/types/action-state.type';

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
  @Input() params!: ISelectedParams;
  @Input() action!: TActionState;

  @Output() onChangeParams = new EventEmitter<Partial<ISelectedParams>>();

  private readonly _emitter$ = new Subject<Partial<ISelectedParams>>();

  constructor() {
    this._emitter$
      .pipe(untilDestroyed(this), debounceTime(300))
      .subscribe({ next: (params) => this.onChangeParams.emit(params) });
  }

  class =
    'h-10 min-h-10 w-full border-white-1000 border-x border-b flex justify-center items-center p-2 relative overflow-hidden';

  id = Math.floor(Math.random() * 900000000) + 100000000;

  emit(params: Partial<ISelectedParams>): void {
    this._emitter$.next(params);
  }
}
