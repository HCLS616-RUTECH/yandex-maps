import { featureCollection, intersect, polygon } from '@turf/turf';
import { TBbox } from '../../models/types/bbox.type';
import { ActionStore } from '../../stores/action.store';
import { SelectedStore } from '../../stores/selected.store';
import { ComputingService } from '../computing.service';
import { MapParamsExtension } from './map.params.extension';

export class IntersectionsExtension {
  private _intersections = new Map<string, any>();

  constructor(
    private readonly _map: any,
    private readonly YANDEX_MAPS: any,
    private readonly _computing: ComputingService,
    private readonly _params: MapParamsExtension,
    private readonly _selected: SelectedStore,
    private readonly _action: ActionStore,
    private readonly _polygons: Map<string, any>
  ) {}

  get isExist(): boolean {
    return !!this._intersections.size;
  }

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
          this._map.geoObjects.add(intersection);
          forAnimate.push(intersection);
        }

        if (!isBBoxesIntersected && isOnMap) {
          intersection.properties.set({ isOnMap: false });
          this._map.geoObjects.remove(intersection);
        }
      });

      if (forAnimate.length) {
        this._params.animatePolygons(forAnimate);
      }
    });
  };

  check = (currentPolygon: any): void => {
    this._deleteIntersections(currentPolygon.properties.get('id'));

    const intersections: any[] = this._getIntersections(currentPolygon);

    if (intersections.length) {
      this._initIntersections(
        intersections,
        currentPolygon.properties.get('id')
      );
    }
  };

  clear = (): void => {
    this._intersections.forEach((polygons, id) =>
      this._deleteIntersections(id)
    );
  };

  private _deleteIntersections = (id: string): void => {
    const intersections = this._intersections.get(id);

    if (intersections) {
      intersections.forEach((p: any) => {
        p.events.remove('click', this._clickHandler);
        this._map.geoObjects.remove(p);
      });
      this._intersections.delete(id);
    }
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

  private _getIntersections = (currentPolygon: any): any[] => {
    const intersections: any[] = [];

    this._polygons.forEach((cachePolygon) => {
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

      const intersection = this._getIntersection(currentPolygon, cachePolygon);

      if (intersection) {
        intersections.push(intersection);
      }
    });

    return intersections;
  };

  private _getIntersection = (
    currentPolygon: any,
    cachePolygon: any
  ): any | null => {
    const turfCurrentPolygon = polygon(
      currentPolygon.geometry.getCoordinates()
    );

    const turfCachePolygon = polygon(cachePolygon.geometry.getCoordinates());

    const intersection = intersect(
      featureCollection([turfCurrentPolygon, turfCachePolygon])
    );

    if (intersection) {
      return new this.YANDEX_MAPS.Polygon(
        intersection.geometry.coordinates,
        {},
        {}
      );
    }

    return null;
  };

  private _initIntersections = (intersections: any[], id: string): void => {
    this._intersections.set(id, intersections);

    intersections.forEach((intersection) => {
      this._map.geoObjects.add(intersection);

      intersection.options.set('fillColor', this._params.intersectionColor);

      intersection.properties.set({
        id,
        bbox: intersection.geometry.getBounds(),
        isOnMap: true,
      });

      intersection.events.add('click', this._clickHandler);
    });

    this._params.animatePolygons(intersections);
  };

  private _clickHandler = (e: any) => {
    const id = e.originalEvent.target.properties.get('id');

    this._selected.state = this._polygons.get(id);

    if (!this._selected.state && this._action.state === 'EDITING_POLYGON') {
      e.originalEvent.target.editor.stopEditing();
      this._action.state = 'EMPTY';
    }
  };
}
