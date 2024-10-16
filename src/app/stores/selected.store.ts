import { Injectable, signal } from '@angular/core';
import { Polygon } from 'yandex-maps';
import { ISelectedParams } from '../models/interfaces/selected-params.interface';
import { TPoint } from '../models/types/point.type';
import { MapParamsExtension } from '../services/extends/map.params.extension';
import { ActionStore } from './action.store';
import { VertexCountStore } from './vertex-count.store';

@Injectable({
  providedIn: 'root',
})
export class SelectedStore {
  private readonly _state = signal<any | null>(null);

  constructor(
    private readonly _params: MapParamsExtension,
    private readonly _action: ActionStore,
    private readonly _vertexCount: VertexCountStore
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
      this._vertexCount.clear();
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

    this._vertexCount.state = this.coordinates.length;
  }

  get params(): ISelectedParams {
    const state = this._state();

    const color: string =
      state.options.get('fillColor') === this._params.dragColor
        ? this._params.colorCache
        : state.options.get('fillColor');

    return {
      color: color.slice(0, 6),
      id: state?.properties.get('id') ?? '',
      name: state?.properties.get('name') ?? '',
    };
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
