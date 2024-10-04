import { Injectable, signal } from '@angular/core';
import { Polygon } from 'yandex-maps';

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
}
