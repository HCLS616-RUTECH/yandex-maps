import { signal } from '@angular/core';
import { featureCollection, intersect, polygon } from '@turf/turf';
import { TBbox } from '../../../models/types/bbox.type';
import { ActionStore } from '../../../stores/action.store';
import { MapSourcesStore } from '../../../stores/map-sources.store';
import { MapStore } from '../../../stores/map.store';
import { SelectedStore } from '../../../stores/selected.store';
import { SettingsStore } from '../../../stores/settings.store';
import { ComputingService } from '../../computing.service';

export class IntersectionsExtension {
  private readonly _intersections = new Map<string, any>();

  private readonly _existence = signal<boolean>(false);

  private _flyIndex = 0;

  constructor(
    private readonly YANDEX_MAPS: any,
    private readonly _map: MapStore,
    private readonly _computing: ComputingService,
    private readonly _settings: SettingsStore,
    private readonly _selected: SelectedStore,
    private readonly _action: ActionStore,
    private readonly _sources: MapSourcesStore
  ) {}

  get existence(): boolean {
    return this._existence();
  }

  fly = (): void => {
    if (!this._intersections.size) {
      return;
    }

    const keys = Array.from(this._intersections.keys());

    const index = this._index();

    const intersection = this._intersections.get(keys[index])[0];

    const bbox = intersection.properties.get('bbox');

    const point = this._computing.getBboxCenter(bbox);

    this._map.fly(point);
  };

  checkBounds = (screenBbox: TBbox): void => {
    if (!this._intersections.size) {
      return;
    }

    this._intersections.forEach((intersections) => {
      const forAnimate: any[] = [];

      intersections.forEach((intersection: any) => {
        const zoneBbox = intersection.properties.get('bbox');

        const isBBoxesIntersected = this._computing.isBBoxesIntersected(
          zoneBbox,
          screenBbox
        );

        const isOnMap = intersection.properties.get('isOnMap');

        if (isBBoxesIntersected && !isOnMap) {
          intersection.properties.set({ isOnMap: true });
          this._map.add(intersection);
          forAnimate.push(intersection);
        }

        if (!isBBoxesIntersected && isOnMap) {
          intersection.properties.set({ isOnMap: false });
          this._map.remove(intersection);
        }
      });

      if (forAnimate.length) {
        this._settings.animate(forAnimate);
      }
    });
  };

  check = (polygon: any): void => {
    const id = polygon.properties.get('id');

    this.delete(id);

    this._checkIntersections(polygon);

    this.checkAll(id);
  };

  checkAll = (ignoredId?: string): void => {
    const ids = Array.from(this._intersections.keys());

    for (const id of ids) {
      if (id === ignoredId) {
        continue;
      }

      this.delete(id);

      const anotherPolygonWithIntersections = this._sources.get(
        id,
        'POLYGONS_ALL'
      );

      if (anotherPolygonWithIntersections) {
        this._checkIntersections(anotherPolygonWithIntersections);
      }
    }

    this._existence.set(!!this._intersections.size);
  };

  clear = (): void => {
    this._intersections.forEach((polygons, id) => this.delete(id));

    this._existence.set(!!this._intersections.size);
  };

  delete = (id: string): void => {
    const intersections = this._intersections.get(id);

    if (intersections) {
      intersections.forEach((p: any) => {
        p.events.remove('click', this._clickHandler);
        this._map.remove(p);
      });
      this._intersections.delete(id);
    }
  };

  private _checkIntersections = (polygon: any): void => {
    const intersections: any[] = this._getIntersections(polygon);

    if (intersections.length) {
      this._initIntersections(intersections, polygon.properties.get('id'));
    }
  };

  private _getIntersections = (currentPolygon: any): any[] => {
    let intersections: any[] = [];

    this._sources.state.polygons.all.forEach((cachePolygon) => {
      if (
        cachePolygon.properties.get('id') ===
        currentPolygon.properties.get('id')
      ) {
        return;
      }

      const isBboxesIntersected = this._isBboxesIntersected(
        currentPolygon,
        cachePolygon
      );

      if (!isBboxesIntersected) {
        return;
      }

      const foundedIntersections = this._getIntersection(
        currentPolygon,
        cachePolygon
      );

      if (foundedIntersections.length) {
        intersections = intersections.concat(foundedIntersections);
      }
    });

    return intersections;
  };

  private _getIntersection = (
    currentPolygon: any,
    cachePolygon: any
  ): any[] => {
    const intersections: any[] = [];

    const turfCurrentPolygon = polygon(
      currentPolygon.geometry.getCoordinates()
    );

    const turfCachePolygon = polygon(cachePolygon.geometry.getCoordinates());

    const intersection = intersect(
      featureCollection([turfCurrentPolygon, turfCachePolygon])
    );

    if (intersection) {
      switch (intersection.geometry.type) {
        case 'MultiPolygon':
          intersection.geometry.coordinates.forEach((c) =>
            intersections.push(new this.YANDEX_MAPS.Polygon(c))
          );
          break;
        default:
          intersections.push(
            new this.YANDEX_MAPS.Polygon(intersection.geometry.coordinates)
          );
      }
    }

    return intersections;
  };

  private _initIntersections = (intersections: any[], id: string): void => {
    this._intersections.set(id, intersections);

    intersections.forEach((intersection) => {
      this._map.add(intersection);

      intersection.options.set('fillColor', this._settings.colors.intersection);

      intersection.properties.set({
        id,
        bbox: intersection.geometry.getBounds(),
        isOnMap: true,
      });

      intersection.events.add('click', this._clickHandler);
    });

    this._settings.animate(intersections);
  };

  private _isBboxesIntersected = (
    currentPolygon: any,
    cachePolygon: any
  ): boolean => {
    const currentBbox =
      currentPolygon.geometry?.getBounds() ??
      (currentPolygon.properties?.get('bbox') as never as TBbox);

    const cacheBbox =
      cachePolygon.geometry?.getBounds() ??
      (cachePolygon.properties?.get('bbox') as never as TBbox);

    return this._computing.isBBoxesIntersected(cacheBbox, currentBbox);
  };

  private _clickHandler = (e: any) => {
    const id = e.originalEvent.target.properties.get('id');

    this._selected.state = this._sources.get(id, 'POLYGONS_ALL');

    if (!this._selected.state && this._action.state === 'EDITING_POLYGON') {
      e.originalEvent.target.editor.stopEditing();
      this._action.state = 'EMPTY';
    }
  };

  private _index = (): number => {
    const current = this._flyIndex;

    this._flyIndex = this._flyIndex + 1;

    if (this._flyIndex > this._intersections.size - 1) {
      this._flyIndex = 0;
    }

    return current;
  };
}
