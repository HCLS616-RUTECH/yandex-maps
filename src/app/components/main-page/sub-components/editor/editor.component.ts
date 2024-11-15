import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { map, Observable, shareReplay } from 'rxjs';
import { VERTICAL_ANIMATION } from '../../../../animations/vertical.animation';
import { IZone } from '../../../../models/interfaces/zone.interface';
import { TActionState } from '../../../../models/types/action-state.type';
import { TChangedParam } from '../../../../models/types/changed-param.type';
import { MapsService } from '../../../../services/maps.service';
import { ActionStore } from '../../../../stores/action.store';
import { SelectedStore } from '../../../../stores/selected.store';
import { VertexesStore } from '../../../../stores/vertexes.store';
import { ActionComponent } from './sub-components/action/action.component';
import { CacheComponent } from './sub-components/cache/cache.component';
import { ChangesComponent } from './sub-components/changes/changes.component';
import { SelectedParamsComponent } from './sub-components/selected-params/selected-params.component';
import { VertexCountComponent } from './sub-components/vertex-count/vertex-count.component';

@UntilDestroy()
@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [
    NgIf,
    AsyncPipe,
    ActionComponent,
    VertexCountComponent,
    SelectedParamsComponent,
    ChangesComponent,
    CacheComponent,
  ],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [VERTICAL_ANIMATION],
})
export class EditorComponent {
  constructor(
    private readonly _mapService: MapsService,
    private readonly _selected: SelectedStore,
    private readonly _vertexes: VertexesStore,
    private readonly _action: ActionStore
  ) {}

  get selected$(): Observable<IZone | null> {
    return this._selected.params$.pipe(untilDestroyed(this), shareReplay(1));
  }

  get vertexes$(): Observable<number> {
    return this._vertexes.state$.pipe(untilDestroyed(this));
  }

  get changes$(): Observable<TChangedParam[] | null> {
    return this._selected.changes$.pipe(
      untilDestroyed(this),
      map((changes) => (changes.length ? changes : null))
    );
  }

  get cache(): { length: number; index: number } {
    return this._selected.cache;
  }

  get action(): TActionState {
    return this._action.state;
  }

  handleChangeParams(params: Partial<IZone>): void {
    this._mapService.setNewParams(params);
  }

  handleClearParams(params: TChangedParam[]): void {
    this._mapService.clearChangedParams(params);
  }

  handleSetCache(to: 'back' | 'forward'): void {
    this._selected.cache = to;
  }
}
