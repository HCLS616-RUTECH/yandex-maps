import { Injectable, signal } from '@angular/core';
import { Polygon } from 'yandex-maps';

@Injectable({
  providedIn: 'root',
})
export class SelectedStore {
  selected = signal<Polygon | null>(null);

  constructor() {}

  setSelectedState(polygon: Polygon): void {
    const selected = this.selected();

    const isSame =
      (polygon.properties.get('id') as never as string) ===
      (selected?.properties.get('id') as never as string);

    if (selected && !isSame) {
      selected.editor.stopEditing();
      selected.options.set('strokeWidth', 1);
    }

    if (isSame) {
      selected?.options.set('strokeWidth', 1);
      this.selected.set(null);
    } else {
      polygon.options.set('strokeWidth', 3);
      this.selected.set(polygon);
    }
  }
}
