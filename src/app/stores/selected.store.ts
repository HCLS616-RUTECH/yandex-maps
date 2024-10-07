import { Injectable, signal } from '@angular/core';
import { Polygon } from 'yandex-maps';
import { TPoint } from '../models/types/point.type';
import { MapParamsExtension } from '../services/extends/map.params.extension';
import { ActionStore } from './action.store';

@Injectable({
  providedIn: 'root',
})
export class SelectedStore {
  private readonly _state = signal<any | null>(null);

  constructor(
    private readonly _params: MapParamsExtension,
    private readonly _action: ActionStore
  ) {}

  get state(): any | null {
    return this._state();
  }

  set state(polygon: Polygon) {
    const selected = this._state();

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
      this._state.set(null);
      return;
    }

    polygon.options.set('strokeWidth', 3);
    this._state.set(polygon);

    switch (this._action.state) {
      case 'EDITING_POLYGON':
        polygon.editor.startEditing();
        break;
      case 'DRAG_POLYGON':
        this._params.startDrag(polygon);
        break;
    }
  }

  get coordinates(): TPoint[] {
    return this._state()?.geometry?.getCoordinates()[0] ?? [];
  }

  set coordinates(coordinates: TPoint[]) {
    this._state()?.geometry?.setCoordinates([coordinates]);

    // Чинит багу с точкой, которая отрывается от вершины при логике с одинаковыми вершинами
    if (this._action.state === 'EDITING_POLYGON') {
      this._state()?.editor.stopEditing();
      this._state()?.editor.startEditing();
    }
  }
}
