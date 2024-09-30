import { Injectable, signal } from '@angular/core';
import { Polygon } from 'yandex-maps';
import { IChangeZonesRequest } from '../models/interfaces/change-zones-request.interface';
import { MapsHttpService } from '../services/maps.http.service';

@Injectable({
  providedIn: 'root',
})
export class ChangesStore {
  isHaveChanges = signal<boolean>(false);

  private _new = new Map<string, any>();
  private _edited = new Map<string, any>();
  private _deleted = new Set<string>();

  constructor(private readonly _http: MapsHttpService) {}

  get changes(): {
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
        bbox: polygon.geometry.getBounds(),
        id: polygon.properties.get('id') as never as string,
        name: polygon.properties.get('name') as never as string,
      })
    );

    this._edited.forEach((polygon) =>
      body.edited.push({
        color: polygon.options.get('fillColor'),
        coordinates: polygon.geometry.getCoordinates(),
        bbox: polygon.geometry.getBounds(),
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

  edit(polygon: Polygon): void {
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

  clearChanges(): void {
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
