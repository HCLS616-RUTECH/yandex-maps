import { Injectable, signal } from '@angular/core';
import { Polygon } from 'yandex-maps';

@Injectable({
  providedIn: 'root',
})
export class SelectedStore {
  private readonly _selected = signal<Polygon | null>(null);

  constructor() {}

  get selected(): Polygon | null {
    return this._selected();
  }

  get isSelected(): boolean {
    return !!this._selected();
  }

  setSelectedState(polygon: Polygon): void {
    const selected = this._selected();

    const isSame =
      (polygon.properties.get('id') as never as string) ===
      (selected?.properties.get('id') as never as string);

    if (selected && !isSame) {
      selected.editor.stopEditing();
      selected.options.set('strokeWidth', 1);
    }

    if (isSame) {
      selected?.options.set('strokeWidth', 1);
      this._selected.set(null);
    } else {
      polygon.options.set('strokeWidth', 3);
      this._selected.set(polygon);
    }
  }
}
