import { Injectable, signal } from '@angular/core';
import { Polygon } from 'yandex-maps';
import { IChangeZonesRequest } from '../models/interfaces/change-zones-request.interface';
import { TBbox } from '../models/types/bbox.type';

@Injectable({
  providedIn: 'root',
})
export class ChangesStore {
  isHaveChanges = signal<boolean>(false);

  private readonly _new = new Map<string, any>();
  private readonly _edited = new Map<string, any>();
  private readonly _deleted = new Set<string>();

  get state(): {
    new: Map<string, any>;
    edited: Map<string, any>;
    deleted: Set<string>;
  } {
    return {
      new: this._new,
      edited: this._edited,
      deleted: this._deleted,
    };
  }

  get requestBody(): IChangeZonesRequest {
    const body: IChangeZonesRequest = { deleted: [], edited: [], new: [] };

    this._new.forEach((polygon) =>
      body.new.push({
        color: polygon.options.get('fillColor'),
        coordinates: polygon.geometry.getCoordinates(),
        bbox:
          polygon.geometry?.getBounds() ??
          (polygon.properties.get('bbox') as never as TBbox),
        id: polygon.properties.get('id') as never as string,
        name: polygon.properties.get('name') as never as string,
      })
    );

    this._edited.forEach((polygon) =>
      body.edited.push({
        color: polygon.options.get('fillColor'),
        coordinates: polygon.geometry.getCoordinates(),
        bbox:
          polygon.geometry?.getBounds() ??
          (polygon.properties.get('bbox') as never as TBbox),
        id: polygon.properties.get('id') as never as string,
        name: polygon.properties.get('name') as never as string,
      })
    );

    body.deleted = Array.from(this._deleted);

    return body;
  }

  create(polygon: Polygon): void {
    const id = polygon.properties.get('id') as never as string;
    this._new.set(id, polygon);
    this._setSignal();
  }

  edit(polygon: any): void {
    const isNew = polygon.properties.get('new') as never as boolean;

    if (!isNew) {
      const id = polygon.properties.get('id') as never as string;
      this._edited.set(id, polygon);
    }

    this._setSignal();
  }

  delete(polygon: Polygon): void {
    const isNew = polygon.properties.get('new') as never as boolean;
    const id = polygon.properties.get('id') as never as string;

    if (isNew) {
      this._new.delete(id);
    } else {
      this._deleted.add(id);
      if (this._edited.has(id)) this._edited.delete(id);
    }

    this._setSignal();
  }

  remove(id: string, from: 'new' | 'edited' | 'delete'): void {
    switch (from) {
      case 'new':
        this._new.delete(id);
        break;
      case 'edited':
        this._edited.delete(id);
        break;
      case 'delete':
        this._deleted.delete(id);
        break;
    }

    this._setSignal();
  }

  clear(): void {
    this._new.clear();
    this._edited.clear();
    this._deleted.clear();

    this._setSignal();
  }

  private _setSignal(): void {
    this.isHaveChanges.set(
      !!this._new.size || !!this._edited.size || !!this._deleted.size
    );
  }
}
