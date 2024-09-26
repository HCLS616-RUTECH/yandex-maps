import { Injectable } from '@angular/core';
import { Polygon } from 'yandex-maps';

@Injectable({
  providedIn: 'root',
})
export class PolygonsStore {
  private _polygons = [];

  private _new = new Map<number, any>();
  private _edited = new Map<number, any>();
  private _deleted = new Set<number>();

  constructor() {}

  get isHaveChanges(): boolean {
    return !!this._new.size || !!this._edited.size || !!this._deleted.size;
  }

  create(polygon: Polygon): void {
    const id = polygon.properties.get('id') as never as number;
    this._new.set(id, polygon);
  }

  edit(polygon: Polygon): void {
    const id = polygon.properties.get('id') as never as number;
    this._edited.set(id, polygon);
  }

  delete(polygon: Polygon): void {
    const id = polygon.properties.get('id') as never as number;
    this._deleted.add(id);
  }
}
