import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { map, Observable, shareReplay } from 'rxjs';
import { TActionState } from '../../../../models/types/action-state.type';
import { MainManager } from '../../../../services/main.manager';
import { HandGrabIcon } from '../../../../shared/icons/hand-grab.icon';
import { LassoPolygonIcon } from '../../../../shared/icons/lasso-polygon.icon';
import { LineIcon } from '../../../../shared/icons/line.icon';
import { PolygonIcon } from '../../../../shared/icons/polygon.icon';
import { TrashXIcon } from '../../../../shared/icons/trash-x.icon';
import { SelectedStore } from '../../../../stores/selected.store';

@UntilDestroy()
@Component({
  selector: 'app-actions',
  standalone: true,
  imports: [
    TrashXIcon,
    HandGrabIcon,
    LassoPolygonIcon,
    PolygonIcon,
    LineIcon,
    AsyncPipe,
  ],
  templateUrl: './actions.component.html',
  styleUrl: './actions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionsComponent {
  classes =
    'transition-all disabled:cursor-not-allowed disabled:text-gray-500 active:scale-95 hover:scale-110 disabled:hover:scale-100';

  constructor(
    private readonly _main: MainManager,
    private readonly _selected: SelectedStore
  ) {}

  get disabled$(): Observable<boolean> {
    return this._selected.selected$.pipe(
      map((selected) => !selected),
      shareReplay(1),
      untilDestroyed(this)
    );
  }

  handleSetActionState(state: TActionState): void {
    this._main.setAction(state);
  }
}
