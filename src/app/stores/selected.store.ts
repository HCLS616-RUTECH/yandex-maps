import { Injectable, signal } from '@angular/core';
import { Polygon } from 'yandex-maps';
import { TPoint } from '../models/types/point.type';

@Injectable({
  providedIn: 'root',
})
export class SelectedStore {
  private readonly _state = signal<any | null>(null);

  get state(): any | null {
    return this._state();
  }

  set state(polygon: Polygon) {
    const selected = this._state();

    const isSame =
      (polygon.properties.get('id') as never as string) ===
      (selected?.properties.get('id') as never as string);

    if (selected && !isSame) {
      selected.editor.stopEditing();
      selected.options.set('strokeWidth', 1);
    }

    if (isSame) {
      selected?.options.set('strokeWidth', 1);
      this._state.set(null);
    } else {
      polygon.options.set('strokeWidth', 3);
      this._state.set(polygon);
    }
  }

  get coordinates(): TPoint[] {
    return this._state()?.geometry?.getCoordinates()[0] ?? [];
  }

  set coordinates(coordinates: TPoint[]) {
    this._state()?.geometry?.setCoordinates([coordinates]);

    // Чинит багу, с точкой, которая отрывается от вершины при логике с одинаковыми вершинами
    this._state()?.editor.stopEditing();
    this._state()?.editor.startEditing();
  }
}
