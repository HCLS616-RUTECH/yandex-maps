import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable, shareReplay } from 'rxjs';
import { VERTICAL_ANIMATION } from '../../../../animations/vertical.animation';
import { ISelectedParams } from '../../../../models/interfaces/selected-params.interface';
import { TActionState } from '../../../../models/types/action-state.type';
import { TChangedParam } from '../../../../models/types/changed-param.type';
import { DebuggerService } from '../../../../services/debugger.service';
import { MapsService } from '../../../../services/maps.service';
import { ActionStore } from '../../../../stores/action.store';
import { SelectedStore } from '../../../../stores/selected.store';
import { VertexCountStore } from '../../../../stores/vertex-count.store';
import { ActionComponent } from './sub-components/action/action.component';
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
    private readonly _vertexCount: VertexCountStore,
    private readonly _action: ActionStore,
    private readonly _debugger: DebuggerService
  ) {}

  get selected$(): Observable<ISelectedParams | null> {
    return this._selected.params$.pipe(untilDestroyed(this), shareReplay(1));
  }

  get changes(): TChangedParam[] | null {
    return this._selected.changes?.changes ?? null;
  }

  get count(): number {
    return this._vertexCount.state;
  }

  get action(): TActionState {
    return this._action.state;
  }

  handleChangeParams(params: Partial<ISelectedParams>): void {
    this._mapService.setNewParams(params);
  }

  handleClearParams(params: TChangedParam[]): void {
    this._mapService.clearChangedParams(params);
  }
}
