import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { TBbox } from '../models/types/bbox.type';
import { TPoint } from '../models/types/point.type';
import { SettingsStore } from './settings.store';

@Injectable({
  providedIn: 'root',
})
export class MapStore {
  private _map!: any;

  private readonly YANDEX_MAPS = (window as any).ymaps;

  constructor(private readonly _settings: SettingsStore) {}

  get state(): any {
    return this._map;
  }

  get bounds(): TBbox {
    return this._map?.getBounds() ?? [];
  }

  init = (request$: Subject<TBbox>): void => {
    const { center, zoom, controls, maxZoom, minZoom } = this._settings.map;

    this._map = new this.YANDEX_MAPS.Map(
      'map',
      { center, zoom, controls },
      { minZoom, maxZoom }
    );

    this._map.events.add('boundschange', (e: any) =>
      request$.next(this.bounds)
    );
  };

  add = (polygon: any): void => {
    this._map?.geoObjects.add(polygon);
  };

  clear = (polygons: Map<string, any>): void => {
    polygons.forEach((polygon) => this.remove(polygon));
  };

  remove = (polygon: any): void => {
    this._map?.geoObjects.remove(polygon);
  };

  fly = (point: TPoint): void => {
    this._map?.panTo(point, {
      flying: true,
      duration: 500,
    });
  };
}
