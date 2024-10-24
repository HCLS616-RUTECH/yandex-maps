import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { Polygon } from 'yandex-maps';
import { ISelectedChanges } from '../models/interfaces/selected-changes.interface';
import { ISelectedParams } from '../models/interfaces/selected-params.interface';
import { IZone } from '../models/interfaces/zone.interface';
import { TBbox } from '../models/types/bbox.type';
import { TChangedParam } from '../models/types/changed-param.type';
import { TPoint } from '../models/types/point.type';
import { DebuggerService } from '../services/debugger.service';
import { MapParamsExtension } from '../services/extends/map.params.extension';
import { SelectedChangesExtension } from '../services/extensions/selected/selected.changes.extension';
import { ActionStore } from './action.store';
import { VertexCountStore } from './vertex-count.store';

interface IChanges {
  params: TChangedParam[];
  action: 'add' | 'clear';
}

@Injectable({
  providedIn: 'root',
})
export class SelectedStore {
  private readonly _state$ = new BehaviorSubject<any | null>(null);

  private readonly _changes: SelectedChangesExtension;

  constructor(
    private readonly _debugger: DebuggerService,
    private readonly _params: MapParamsExtension,
    private readonly _action: ActionStore,
    private readonly _vertexCount: VertexCountStore
  ) {
    this._changes = new SelectedChangesExtension(
      this._state$,
      this._vertexCount,
      this._debugger
    );
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
        this._params.stopDrag(selected);
        break;
    }

    selected?.options.set('strokeWidth', 1);

    if (isSame) {
      this._action.state = 'EMPTY';
      this._state$.next(null);
      this._vertexCount.clear();
      this._changes.check();
      return;
    }

    polygon.options.set('strokeWidth', 3);
    this._state$.next(polygon);

    switch (this._action.state) {
      case 'EDITING_POLYGON':
        polygon.editor.startEditing();
        break;
      case 'DRAG_POLYGON':
        this._params.startDrag(polygon);
        break;
    }

    this._vertexCount.state = this.coordinates.length;
    this._changes.check();
  }

  get params$(): Observable<ISelectedParams | null> {
    return this._state$.asObservable().pipe(map(() => this.params));
  }

  get params(): ISelectedParams | null {
    const { value } = this._state$;

    if (!value) {
      return value;
    }

    const fillColor: string = value.options.get('fillColor').slice(0, 6);
    const dragColor: string = this._params.dragColor.slice(0, 6);

    const color: string =
      fillColor === dragColor ? this._params.colorCache.slice(0, 6) : fillColor;

    return {
      color: `#${color}`,
      id: value.properties.get('id'),
      name: value.properties.get('name'),
    };
  }

  set params({ name, color }: Partial<ISelectedParams>) {
    const { value } = this._state$;
    if (!value) {
      return;
    }

    const toAdd: TChangedParam[] = [];
    const toClear: TChangedParam[] = [];

    const defaultParams = value.properties.get('default') as Omit<IZone, 'id'>;

    if (name) {
      value.properties.set({ name });

      name === defaultParams.name ? toClear.push('name') : toAdd.push('name');
    }

    if (color) {
      color = `${color.replace('#', '')}${this._params.opacity}`;
      value.options.set('fillColor', color);

      color === defaultParams.color
        ? toClear.push('color')
        : toAdd.push('color');
    }

    if (toAdd.length) {
      this._changes.add(toAdd);
    }

    if (toClear.length) {
      this._changes.clear(toClear);
    }
  }

  get coordinates(): TPoint[] {
    return this._state$.value?.geometry?.getCoordinates()[0] ?? [];
  }

  set coordinates(coordinates: TPoint[]) {
    this._state$.value?.geometry?.setCoordinates([coordinates]);

    // Чинит багу с точкой, которая отрывается от вершины при логике с одинаковыми вершинами
    if (this._action.state === 'EDITING_POLYGON') {
      this._state$.value?.editor.stopEditing();
      this._state$.value?.editor.startEditing();
    }
  }

  get bounds(): TBbox {
    return (
      this._state$.value?.geometry?.getBounds() ??
      this._state$.value?.properties.get('bbox') ??
      []
    );
  }

  set bounds(bbox: TBbox) {
    this._state$.value?.properties.set({ bbox });
  }

  get changes(): ISelectedChanges | null {
    return this._changes.state;
  }

  set changes({ params, action }: IChanges) {
    this._changes[action](params);
  }

  get drag(): boolean {
    return this._state$.value?.properties.get('drag') ?? false;
  }

  set drag(state: boolean) {
    this._state$.value?.properties.set({ drag: state });
  }

  get computing(): boolean {
    return this._state$.value?.properties.get('computing') ?? false;
  }

  set computing(state: boolean) {
    this._state$.value?.properties.set({ computing: state });
  }

  clear(): void {
    if (this._state$.value) {
      this.state = this._state$.value;
    }
  }
}
