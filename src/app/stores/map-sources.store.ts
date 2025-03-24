import { Injectable } from '@angular/core';
import { Queue } from '../models/classes/queue';
import { IOptions } from '../models/interfaces/options.interface';
import { IZone } from '../models/interfaces/zone.interface';
import { TBbox } from '../models/types/bbox.type';
import { TCache } from '../models/types/cache.type';
import { TPoint } from '../models/types/point.type';
import { SettingsStore } from './settings.store';

interface IGetOptions {
  fromZone: (zone: IZone) => IOptions;
  forNew: (id: string, coordinates: TPoint[], bbox: TBbox) => IOptions;
}

interface ISources {
  polygons: { all: Map<string, any>; visible: Map<string, any> };
  zones: Set<string>;
}

type TState = 'ZONES' | 'POLYGONS_ALL' | 'POLYGONS_VISIBLE';

@Injectable({
  providedIn: 'root',
})
export class MapSourcesStore {
  private readonly _state: ISources = {
    polygons: {
      all: new Map(),
      visible: new Map(),
    },
    zones: new Set(),
  };

  constructor(private readonly _settings: SettingsStore) {}

  get state(): ISources {
    return this._state;
  }

  get add() {
    return {
      zone: (id: string) => this._state.zones.add(id),
      polygon: {
        all: (id: string, polygon: any) =>
          this._state.polygons.all.set(id, polygon),
        visible: (id: string, polygon: any) =>
          this._state.polygons.visible.set(id, polygon),
      },
    };
  }

  get options(): IGetOptions {
    return {
      forNew: this._getOptionsForNewPolygon,
      fromZone: this._getOptionsFromZone,
    };
  }

  has = (id: string, state: TState): boolean => {
    switch (state) {
      case 'ZONES':
        return this._state.zones.has(id);
      case 'POLYGONS_ALL':
        return this._state.polygons.all.has(id);
      case 'POLYGONS_VISIBLE':
        return this._state.polygons.visible.has(id);
      default:
        return false;
    }
  };

  get = (id: string, state: TState): any | null => {
    switch (state) {
      case 'POLYGONS_ALL':
        return this._state.polygons.all.get(id);
      case 'POLYGONS_VISIBLE':
        return this._state.polygons.visible.get(id);
      default:
        return null;
    }
  };

  values = (state: TState): any[] => {
    switch (state) {
      case 'ZONES':
        return Array.from(this._state.zones.values());
      case 'POLYGONS_ALL':
        return Array.from(this._state.polygons.all.values());
      case 'POLYGONS_VISIBLE':
        return Array.from(this._state.polygons.visible.values());
      default:
        return [];
    }
  };

  clear = (state?: TState): void => {
    switch (state) {
      case 'ZONES':
        return this._state.zones.clear();
      case 'POLYGONS_ALL':
        return this._state.polygons.all.clear();
      case 'POLYGONS_VISIBLE':
        return this._state.polygons.visible.clear();
      default:
        this._state.polygons.all.clear();
        this._state.polygons.visible.clear();
        this._state.zones.clear();
    }
  };

  remove = (id: string, state: TState): boolean => {
    switch (state) {
      case 'ZONES':
        return this._state.zones.delete(id);
      case 'POLYGONS_ALL':
        return this._state.polygons.all.delete(id);
      case 'POLYGONS_VISIBLE':
        return this._state.polygons.visible.delete(id);
    }
  };

  private _getOptionsFromZone = (zone: IZone): IOptions => {
    return {
      id: zone.id,
      name: zone.name,
      bbox: zone.bbox,
      new: false,
      default: {
        coordinates: zone.coordinates,
        bbox: zone.bbox,
        name: zone.name,
        color: zone.color,
      },
      cache: {
        index: 0,
        queue: new Queue<TCache>({
          name: zone.name,
          color: zone.color,
          coordinates: zone.coordinates,
        }),
      },
      manipulations: { caches: false, computing: false, drag: false },
      changes: new Set(),
    };
  };

  private _getOptionsForNewPolygon = (
    id: string,
    coordinates: TPoint[],
    bbox: TBbox
  ): IOptions => {
    return {
      id,
      name: `Новая зона ${id}`,
      bbox,
      new: false,
      default: {
        coordinates: [coordinates],
        bbox,
        name: `Новая зона ${id}`,
        color: this._settings.colors.base,
      },
      cache: {
        index: 0,
        queue: new Queue<TCache>({
          name: `Новая зона ${id}`,
          color: this._settings.colors.base,
          coordinates: [coordinates],
        }),
      },
      manipulations: { caches: false, computing: false, drag: false },
      changes: new Set(),
    };
  };
}
