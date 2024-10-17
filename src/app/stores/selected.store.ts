import { Injectable } from '@angular/core';
import { BehaviorSubject, map, Observable } from 'rxjs';
import { Polygon } from 'yandex-maps';
import { ISelectedParams } from '../models/interfaces/selected-params.interface';
import { TBbox } from '../models/types/bbox.type';
import { TPoint } from '../models/types/point.type';
import { MapParamsExtension } from '../services/extends/map.params.extension';
import { ActionStore } from './action.store';
import { VertexCountStore } from './vertex-count.store';

@Injectable({
  providedIn: 'root',
})
export class SelectedStore {
  private readonly _state$ = new BehaviorSubject<any | null>(null);

  constructor(
    private readonly _params: MapParamsExtension,
    private readonly _action: ActionStore,
    private readonly _vertexCount: VertexCountStore
  ) {}

  get params$(): Observable<ISelectedParams | null> {
    return this._state$.asObservable().pipe(
      map((state) => {
        if (!state) {
          return state;
        }

        const fillColor: string = state.options.get('fillColor').slice(0, 6);
        const dragColor: string = this._params.dragColor.slice(0, 6);

        const color: string =
          fillColor === dragColor
            ? this._params.colorCache.slice(0, 6)
            : fillColor;

        return {
          color,
          id: state?.properties.get('id') ?? '',
          name: state?.properties.get('name') ?? '',
        };
      })
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
    return this._state$.value?.geometry.getBounds() ?? [];
  }

  clear(): void {
    if (this._state$.value) {
      this.state = this._state$.value;
    }
  }
}
