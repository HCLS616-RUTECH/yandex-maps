import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ISelectedChanges } from '../../../models/interfaces/selected-changes.interface';
import { IZone } from '../../../models/interfaces/zone.interface';
import { TChangedParam } from '../../../models/types/changed-param.type';
import { VertexCountStore } from '../../../stores/vertex-count.store';
import { DebuggerService } from '../../debugger.service';

export class SelectedChangesExtension {
  private readonly _state = signal<ISelectedChanges | null>(null);

  constructor(
    private readonly _selected$: BehaviorSubject<any | null>,
    private readonly _vertexCount: VertexCountStore,
    private readonly _debugger: DebuggerService
  ) {}

  get state(): ISelectedChanges | null {
    return this._state();
  }

  add = (params: TChangedParam[]): void => {
    const { value } = this._selected$;

    if (!value) {
      return;
    }

    if (value.properties.get('new')) {
      return;
    }

    const changes: Set<TChangedParam> =
      value.properties.get('changes') ?? new Set();

    params.forEach((param) => {
      changes.add(param);
    });

    value.properties.set({ changes });

    this.check();
  };

  clear = (params: TChangedParam[]): void => {
    const { value } = this._selected$;

    if (!value) {
      return;
    }

    const defaultParams = value.properties.get('default') as Omit<IZone, 'id'>;
    const changes = value.properties.get('changes') as Set<TChangedParam>;

    params.forEach((param) => {
      switch (param) {
        case 'coordinates':
          value.geometry?.setCoordinates(defaultParams.coordinates);
          value.properties.set({ bbox: defaultParams.bbox });
          this._vertexCount.state = defaultParams.coordinates[0].length;
          break;
        case 'name':
          value.properties.set({ name: defaultParams.name });
          break;
        case 'color':
          value.options.set('fillColor', defaultParams.color);
          break;
      }

      changes.delete(param);
    });

    value.properties.set({ changes });

    this.check();
  };

  check = (): void => {
    const { value } = this._selected$;

    if (!value) {
      return this._state.set(null);
    }

    const changes: Set<TChangedParam> = value.properties.get('changes');

    if (!changes?.size) {
      return this._state.set(null);
    }

    const id = value.properties.get('id') as never as string;

    this._state.set({ id, changes: Array.from(changes) });
  };
}
