import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { Polygon } from 'yandex-maps';
import { IOptions } from '../models/interfaces/options.interface';
import { IZone } from '../models/interfaces/zone.interface';
import { TBbox } from '../models/types/bbox.type';
import { TCache } from '../models/types/cache.type';
import { TChangedParam } from '../models/types/changed-param.type';
import { TDefaultParams } from '../models/types/default-params.type';
import { TPoint } from '../models/types/point.type';
import { ComputingService } from '../services/computing.service';
import { MapSettingsExtension } from '../services/extensions/map/map.settings.extension';
import { SelectedCacheExtension } from '../services/extensions/selected/selected.cache.extension';
import { SelectedChangesExtension } from '../services/extensions/selected/selected.changes.extension';
import { SelectedParamsExtension } from '../services/extensions/selected/selected.params.extension';
import { ActionStore } from './action.store';
import { VertexesStore } from './vertexes.store';

@Injectable({
  providedIn: 'root',
})
export class SelectedStore {
  private readonly _state$ = new BehaviorSubject<any | null>(null);

  private readonly _cache: SelectedCacheExtension;
  private readonly _changes: SelectedChangesExtension;
  private readonly _params: SelectedParamsExtension;

  constructor(
    private readonly _settings: MapSettingsExtension,
    private readonly _action: ActionStore,
    private readonly _vertexes: VertexesStore,
    private readonly _computing: ComputingService
  ) {
    this._params = new SelectedParamsExtension(
      this,
      this._settings,
      this._action,
      this._computing
    );

    this._changes = new SelectedChangesExtension(this);

    this._cache = new SelectedCacheExtension(this, this._params, this._changes);

    this._vertexes.state = this._state$
      .asObservable()
      .pipe(map(() => this._params.coordinates.length));
  }

  get state(): any | null {
    return this._state$.value;
  }

  set state(polygon: Polygon) {
    const selected = this._state$.value;

    const isSame =
      (polygon.properties.get('id') as never as string) ===
      (selected?.properties.get('id') as never as string);

    switch (this._action.state) {
      case 'EDITING_POLYGON':
        selected?.editor.stopEditing();
        break;
      case 'DRAG_POLYGON':
        this._settings.stopDrag(selected);
        break;
    }

    selected?.options.set('strokeWidth', 1);

    if (isSame) {
      this._action.state = 'EMPTY';
      this._state$.next(null);
      return;
    }

    polygon.options.set('strokeWidth', 3);
    this._state$.next(polygon);

    switch (this._action.state) {
      case 'EDITING_POLYGON':
        polygon.editor.startEditing();
        break;
      case 'DRAG_POLYGON':
        this._settings.startDrag(polygon);
        break;
    }
  }

  get params$(): Observable<IZone | null> {
    return this._state$.asObservable().pipe(map(() => this._params.state));
  }

  get params(): IZone | null {
    return this._params.state;
  }

  set params(params: Partial<IZone>) {
    if (!this._state$.value) {
      return;
    }

    this._params.state = params;

    this.check(params);
  }

  get coordinates(): TPoint[] {
    return this._params.coordinates;
  }

  get bbox(): TBbox {
    return this._params.bbox;
  }

  get changes$(): Observable<TChangedParam[]> {
    return this._state$.asObservable().pipe(map(() => this._changes.state));
  }

  get changes(): TChangedParam[] {
    return this._changes.state;
  }

  get manipulations(): IOptions['manipulations'] {
    const manipulations = this._state$.value?.properties.get('manipulations');

    return {
      caches: manipulations.caches ?? false,
      computing: manipulations.computing ?? false,
      drag: manipulations.drag ?? false,
    };
  }

  set manipulations(state: Partial<IOptions['manipulations']>) {
    const { value } = this._state$;
    if (!value) {
      return;
    }

    const manipulations = {
      ...value.properties.get('manipulations'),
      ...state,
    };

    value.properties.set({ manipulations });
  }

  get cache(): { length: number; index: number } {
    const { value } = this._state$;
    if (!value) {
      return { length: 0, index: -1 };
    }

    const { queue, index } = value.properties.get('cache') as IOptions['cache'];

    return { length: queue.length, index };
  }

  set cache(to: 'back' | 'forward') {
    this._cache.go(to);

    this.update();
  }

  get defaultParams(): TDefaultParams | null {
    return this._params.default;
  }

  clear(): void {
    if (this._state$.value) {
      this.state = this._state$.value;
    }
  }

  update(): void {
    this._state$.next(this._state$.value);
  }

  check(params: Partial<IZone>): void {
    if (this.manipulations.caches) {
      return;
    }

    const keys = Object.keys(params) as TChangedParam[];
    const result = this._params.checkIsDefault(keys);

    const { name, color, coordinates } = this.params!;

    const cache: TCache = { name, color, coordinates };

    keys.forEach((key) => {
      result[key] ? this._changes.remove([key]) : this._changes.add([key]);

      cache[key] = params[key] as string & TPoint[][];
    });

    this._cache.add(cache);

    this.update();
  }
}
