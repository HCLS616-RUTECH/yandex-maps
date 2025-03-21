import { Injectable } from '@angular/core';
import { debounceTime, Subject, switchMap, take } from 'rxjs';
import { Polygon } from 'yandex-maps';
import { IZone } from '../models/interfaces/zone.interface';
import { TActionState } from '../models/types/action-state.type';
import { TBbox } from '../models/types/bbox.type';
import { TChangedParam } from '../models/types/changed-param.type';
import { TPoint } from '../models/types/point.type';
import { ActionStore } from '../stores/action.store';
import { ChangesStore } from '../stores/changes.store';
import { MapSourcesStore } from '../stores/map-sources.store';
import { MapStore } from '../stores/map.store';
import { SelectedStore } from '../stores/selected.store';
import { VersionsStore } from '../stores/versions.store';
import { VertexesStore } from '../stores/vertexes.store';
import { ComputingService } from './computing.service';
import { IntersectionsExtension } from './extends/map.intersections.extension';
import { PolygonExtension } from './extends/map.polygon.extension';
import { PolylineExtension } from './extends/map.polyline.extension';
import { MapKeyboardExtension } from './extensions/map/map.keyboard.extension';
import { MapSettingsExtension } from './extensions/map/map.settings.extension';
import { MapsHttpService } from './maps.http.service';

// TODO: 1. Бага с цветом при перетаскивании (быстро нажимать)                                             -
// TODO: 2. editorMenuManager: завершить рисование для полигона, удалить добавить внутренний контур        -
// TODO: 3. Декомпозировать основной сервис                                                                -
// TODO: 4. Бага с дижением кэша вправо по клавише                                                         -
// TODO: 5. Бага с добавлением первой точки нового полигона или кривой в пределах существующего полигона   -

interface IExtensions {
  polyline: PolylineExtension;
  polygon: PolygonExtension;
  intersections: IntersectionsExtension;
  keyboard: MapKeyboardExtension;
}

@Injectable({
  providedIn: 'root',
})
export class MapsService {
  private _polyline: any | PolylineExtension;
  private _polygon: any | PolygonExtension;
  private _intersections: any | IntersectionsExtension;
  private _keyboard: any | MapKeyboardExtension;

  private readonly _request$ = new Subject<TBbox>();

  private readonly YANDEX_MAPS = (window as any).ymaps;

  constructor(
    private readonly _http: MapsHttpService,
    private readonly _map: MapStore,
    private readonly _sources: MapSourcesStore,
    private readonly _settings: MapSettingsExtension,
    private readonly _versions: VersionsStore,
    private readonly _computing: ComputingService,
    private readonly _changes: ChangesStore,
    private readonly _action: ActionStore,
    private readonly _selected: SelectedStore,
    private readonly _vertexes: VertexesStore
  ) {
    this.YANDEX_MAPS.ready(() => {
      this._versions.yandex = this.YANDEX_MAPS.meta.version;

      this._map.init(this._request$);

      this._polyline = new PolylineExtension(
        this._map.state,
        this.YANDEX_MAPS,
        this._action,
        this._vertexes,
        this._computing,
        this._settings
      );

      this._polygon = new PolygonExtension(
        this._map.state,
        this.YANDEX_MAPS,
        this._action,
        this._vertexes,
        this._computing,
        this._settings
      );

      this._intersections = new IntersectionsExtension(
        this._map.state,
        this.YANDEX_MAPS,
        this._computing,
        this._settings,
        this._selected,
        this._action,
        this._sources
      );

      this._keyboard = new MapKeyboardExtension(
        this,
        this._action,
        this._selected
      );

      this._request$
        .pipe(
          debounceTime(300),
          switchMap((bbox) => this._http.getZones(bbox))
        )
        .subscribe({
          next: (zones) => {
            this._addNewPolygons(zones);
          },
        });

      // this._map.events.add('click', (event: any) =>
      //   console.log(event.get('coords'))
      // );

      this._request$.next(this._map.bounds);

      document.querySelector('.ymaps-2-1-79-map-copyrights-promo')?.remove();
    });
  }

  get intersections(): boolean {
    return this._intersections?.existence ?? false;
  }

  keyboardHandler = (event: KeyboardEvent): void => {
    this._keyboard.handler(event);
  };

  flyToIntersection = (): void => {
    this._intersections.fly();
  };

  setActionState(state: TActionState): void {
    switch (state) {
      case 'DRAWING_POLYGON':
        this._drawingPolygon();
        break;
      case 'DRAWING_POLYLINE':
        this._drawingPolyline();
        break;
      case 'EDITING_POLYGON':
        this._editPolygon();
        break;
      case 'DELETE_POLYGON':
        this._deletePolygon();
        break;
      case 'DRAG_POLYGON':
        this._dragPolygon();
        break;
    }
  }

  updateMap(): void {
    this._map.clear(this._sources.state.polygons.all);
    this._sources.clear();

    this._map.clear(this._changes.state.new);
    this._changes.clear();

    this._intersections.clear();

    this.clearShapes();

    this._action.state = 'EMPTY';

    this._request$.next(this._map.bounds);
  }

  saveChanges(): void {
    if (!this._changes.isHaveChanges()) {
      return;
    }

    const body = this._changes.requestBody;

    this._http.saveChanges(body).pipe(take(1)).subscribe();
  }

  setNewParams = (params: Partial<IZone>): void => {
    if (!this._selected.state) {
      return;
    }

    this._selected.params = params;

    this._selected.changes.length
      ? this._changes.edit(this._selected.state)
      : this._changes.remove(this._selected.params!.id, 'edited');
  };

  clearChangedParams = (params: TChangedParam[]): void => {
    if (!this._selected.state) {
      return;
    }

    this._selected.manipulations = { computing: true };

    const defaultParams = this._selected.defaultParams!;

    this._selected.params = params.reduce(
      (acc, key) => ({ ...acc, [key]: defaultParams[key] }),
      {}
    );

    this._selected.changes.length
      ? this._changes.edit(this._selected.state)
      : this._changes.remove(this._selected.params!.id, 'edited');

    this._selected.manipulations = { computing: false };
  };

  clearShapes = (): void => {
    this._polyline.clear(this._drawingHandler);
    this._polygon.clear(this._drawingHandler);
    this._selected.clear();
  };

  private _addNewPolygons(zones: IZone[]): void {
    const changes = this._changes.state;
    this._sources.clear('ZONES');

    const newPolygons: Polygon[] = [];

    for (let zone of zones) {
      if (changes.deleted.has(zone.id)) {
        continue;
      }

      this._sources.add.zone(zone.id);

      const visible = this._sources.get(zone.id, 'POLYGONS_VISIBLE');

      if (visible) {
        // Чинит багу яндекс карт, при которой не до конца отрисовывается полигон, при движении экрана по картам
        visible.options.set('fillColor', visible.options.get('fillColor'));
        continue;
      }

      if (this._sources.has(zone.id, 'POLYGONS_ALL')) {
        const current = this._sources.get(zone.id, 'POLYGONS_ALL');
        this._sources.add.polygon.visible(zone.id, current);
        this._map.add(current);
        newPolygons.push(current);
        continue;
      }

      const options = this._sources.options(zone, false);

      const polygon = new this.YANDEX_MAPS.Polygon(zone.coordinates, options, {
        ...this._settings.stroke,
        fillColor: zone.color,
      });

      this._initPolygonActions(polygon);

      newPolygons.push(polygon);
      this._sources.add.polygon.all(zone.id, polygon);
      this._sources.add.polygon.visible(zone.id, polygon);
      this._map.add(polygon);
    }

    this._sources.state.polygons.visible.forEach((polygon, id) => {
      const requirement =
        !this._sources.has(id, 'ZONES') &&
        !changes.new.has(id) &&
        !changes.edited.has(id);

      if (requirement) {
        this._map.remove(polygon);
        this._sources.remove(id, 'POLYGONS_VISIBLE');
      }
    });

    const { bounds } = this._map;

    changes.edited.forEach((polygon, id) => {
      const isBboxesIntersected = this._computing.isBBoxesIntersected(
        polygon.properties.get('bbox') as never as TBbox,
        bounds
      );

      if (isBboxesIntersected && this._sources.has(id, 'POLYGONS_VISIBLE')) {
        return;
      }

      if (!isBboxesIntersected && this._sources.has(id, 'POLYGONS_VISIBLE')) {
        this._map.remove(polygon);
        this._sources.remove(id, 'POLYGONS_VISIBLE');
      }

      if (isBboxesIntersected && !this._sources.has(id, 'POLYGONS_VISIBLE')) {
        this._sources.add.polygon.visible(id, polygon);
        this._map.add(polygon);
        newPolygons.push(polygon);
      }
    });

    changes.new.forEach((polygon, id) => {
      const isBboxesIntersected = this._computing.isBBoxesIntersected(
        polygon.properties.get('bbox') as never as TBbox,
        bounds
      );

      if (!isBboxesIntersected && this._sources.has(id, 'POLYGONS_VISIBLE')) {
        this._map.remove(polygon);
        this._sources.remove(id, 'POLYGONS_VISIBLE');
      }

      if (isBboxesIntersected && !this._sources.has(id, 'POLYGONS_VISIBLE')) {
        this._sources.add.polygon.visible(id, polygon);
        this._map.add(polygon);
        newPolygons.push(polygon);
      }
    });

    this._settings.animatePolygons(newPolygons);

    this._intersections.checkBounds(bounds);
  }

  private _drawingPolygon(): void {
    this._selected.clear();
    this._polyline.clear(this._drawingHandler);

    this._action.state = 'DRAWING_POLYGON';

    switch (this._action.state) {
      case 'DRAWING_POLYGON':
        this._polygon.startDrawing(this._drawingHandler);

        this._polygon.emitter$.pipe(take(1)).subscribe({
          next: (polygon: any) => this._initNewPolygon(polygon),
        });
        break;
      default:
        this._polygon.stopDrawing(this._drawingHandler);
    }
  }

  private _drawingPolyline(): void {
    this._selected.clear();
    this._polygon.clear(this._drawingHandler);

    this._action.state = 'DRAWING_POLYLINE';

    switch (this._action.state) {
      case 'DRAWING_POLYLINE':
        this._polyline.startDrawing(this._drawingHandler);

        this._polyline.emitter$.pipe(take(1)).subscribe({
          next: (polygon: any) => this._initNewPolygon(polygon),
        });
        break;
      default:
        this._polyline.stopDrawing(this._drawingHandler);
    }
  }

  private _initNewPolygon = (polygon: any) => {
    if (polygon) {
      const id = polygon.properties.get('id') as string;

      this._changes.create(polygon);

      this._initPolygonActions(polygon);

      this._selected.state = polygon;
      this.setActionState('EDITING_POLYGON');

      this._sources.add.polygon.all(id, polygon);
      this._sources.add.polygon.visible(id, polygon);

      this._intersections.check(polygon);
    }
  };

  private _editPolygon(): void {
    const selected = this._selected.state;
    if (!selected) {
      return;
    }

    if (this._action.state === 'DRAG_POLYGON') {
      this._settings.stopDrag(selected);
    }

    this._action.state = 'EDITING_POLYGON';

    this._action.state === 'EDITING_POLYGON'
      ? selected.editor.startEditing()
      : selected.editor.stopEditing();
  }

  private _deletePolygon(): void {
    const selected = this._selected.state;
    if (!selected) {
      return;
    }

    const id = selected.properties.get('id') as never as string;

    this._sources.remove(id, 'POLYGONS_ALL');
    this._sources.remove(id, 'POLYGONS_VISIBLE');

    this._changes.delete(selected);

    this._map.remove(selected);

    this._intersections.delete(id);
    this._intersections.checkAll();

    this._selected.clear();
  }

  private _dragPolygon(): void {
    const selected = this._selected.state;
    if (!selected) {
      return;
    }

    if (this._action.state === 'EDITING_POLYGON') {
      selected.editor.stopEditing();
    }

    this._action.state = 'DRAG_POLYGON';

    this._action.state === 'DRAG_POLYGON'
      ? this._settings.startDrag(selected)
      : this._settings.stopDrag(selected);
  }

  private _initPolygonActions = (polygon: Polygon): void => {
    polygon.events.add('click', (e: any) => {
      this._selected.state = e.originalEvent.target;
      if (!this._selected.state && this._action.state === 'EDITING_POLYGON') {
        e.originalEvent.target.editor.stopEditing();
        this._action.state = 'EMPTY';
      }
    });

    polygon.events.add('geometrychange', this._geometryChangeHandler);

    polygon.events.add(
      'dragstart',
      () => (this._selected.manipulations = { drag: true })
    );

    polygon.events.add('dragend', this._dragendHandler);
  };

  private _drawingHandler = (event: any): void => {
    const { oldCoordinates, newCoordinates } = event.originalEvent;

    let vertexIndex = 0;

    switch (this._action.state) {
      case 'DRAWING_POLYLINE':
        vertexIndex = this._computing.findVertexIndex(
          oldCoordinates,
          newCoordinates
        );
        break;
      case 'DRAWING_POLYGON':
        vertexIndex = this._computing.findVertexIndex(
          oldCoordinates[0] ?? [],
          newCoordinates[0]
        );
        break;
    }

    this._checkPoint(vertexIndex);

    switch (this._action.state) {
      case 'DRAWING_POLYLINE':
        this._polyline.update();
        break;
      case 'DRAWING_POLYGON':
        this._polygon.update();
        break;
    }
  };

  private _geometryChangeHandler = (event: any): void => {
    if (this._selected.manipulations.drag) {
      return;
    }

    if (this._selected.manipulations.computing) {
      return;
    }

    this._selected.manipulations = { computing: true };

    const { oldCoordinates, newCoordinates } =
      event.originalEvent.originalEvent.originalEvent;

    const vertexIndex = this._computing.findVertexIndex(
      oldCoordinates[0],
      newCoordinates[0]
    );

    this._checkPoint(vertexIndex);

    this._intersections.check(this._selected.state);

    this._selected.changes.length
      ? this._changes.edit(this._selected.state)
      : this._changes.remove(this._selected.params!.id, 'edited');

    this._selected.manipulations = { computing: false };
  };

  private _dragendHandler = (event: any): void => {
    const coordinates = this._selected.coordinates;
    const result: { [key: string]: TPoint[] } = {};

    for (let i = 0; i < coordinates.length; i++) {
      const current = this._checkCoordinates(i, coordinates);

      if (current) {
        result[i] = current;
      }
    }

    const indexes = Object.keys(result);

    if (indexes.length) {
      let newCoordinates = coordinates;

      indexes.forEach(
        // @ts-ignore
        (index) => (newCoordinates[index] = result[index][index])
      );

      this.setNewParams({
        coordinates: [this._computing.deleteSamePoints(newCoordinates)],
      });
    } else {
      this._selected.check({ coordinates: [coordinates] });
    }

    this._selected.changes.length
      ? this._changes.edit(this._selected.state)
      : this._changes.remove(this._selected.params!.id, 'edited');

    this._intersections.check(this._selected.state);

    this._selected.manipulations = { drag: false };
  };

  private _checkPoint = (vertexIndex: number): void => {
    let coordinates = [];

    switch (this._action.state) {
      case 'DRAWING_POLYLINE':
        coordinates = this._polyline.coordinates;
        break;
      case 'DRAWING_POLYGON':
        coordinates = this._polygon.coordinates;
        break;
      case 'EDITING_POLYGON':
        coordinates = this._selected.coordinates;
        break;
    }

    const checkResult = this._checkCoordinates(vertexIndex, coordinates);

    if (checkResult) {
      switch (this._action.state) {
        case 'DRAWING_POLYLINE':
          this._polyline.coordinates = checkResult;
          break;
        case 'DRAWING_POLYGON':
          this._polygon.coordinates = checkResult;
          break;
        case 'EDITING_POLYGON':
          this.setNewParams({ coordinates: [checkResult] });
          break;
      }
    }

    if (!checkResult && this._action.state === 'EDITING_POLYGON') {
      this._selected.check({ coordinates: [this._selected.coordinates] });
    }
  };

  private _checkCoordinates = (
    vertexIndex: number,
    coordinates: TPoint[]
  ): TPoint[] | null => {
    let result: TPoint[] | null = null;

    const newPoint = coordinates[vertexIndex];

    const polygons = this._sources.values('POLYGONS_ALL');

    for (let i = 0; i < polygons.length; i++) {
      if (
        polygons[i].properties.get('id') ===
        this._selected.state?.properties.get('id')
      ) {
        continue;
      }

      const bbox = polygons[i].properties.get('bbox') as never as TBbox;

      if (!this._computing.isPointInBBox(newPoint, bbox)) {
        continue;
      }

      const isPointInPolygon = this._computing.isPointInPolygon(
        newPoint,
        polygons[i].geometry.getCoordinates()[0]
      );

      if (isPointInPolygon) {
        const closestPoint = this._computing.getClosestPoint(
          newPoint,
          polygons[i].geometry.getCoordinates()[0]
        );

        switch (this._action.state) {
          case 'DRAWING_POLYLINE':
            result = this._changeCoordinatesForPolyline(
              vertexIndex,
              coordinates,
              closestPoint
            );
            break;
          case 'DRAWING_POLYGON':
          case 'EDITING_POLYGON':
          case 'DRAG_POLYGON':
            result = this._changeCoordinatesForPolygon(
              vertexIndex,
              coordinates,
              closestPoint
            );
            break;
        }

        break;
      }
    }

    return result;
  };

  private _changeCoordinatesForPolyline = (
    vertexIndex: number,
    coordinates: TPoint[],
    closestPoint: TPoint
  ): TPoint[] => {
    let newCoordinates = coordinates.slice();

    newCoordinates[vertexIndex] = closestPoint;

    if (newCoordinates.length > 1) {
      const isSamePoint = !!vertexIndex
        ? this._computing.isSamePoints(
            coordinates[vertexIndex - 1],
            closestPoint
          )
        : this._computing.isSamePoints(
            coordinates[vertexIndex + 1],
            closestPoint
          );

      if (isSamePoint) {
        newCoordinates = !!vertexIndex
          ? newCoordinates.slice(0, coordinates.length - 1)
          : newCoordinates.slice(1, coordinates.length);
      }
    }

    return newCoordinates;
  };

  private _changeCoordinatesForPolygon = (
    vertexIndex: number,
    coordinates: TPoint[],
    closestPoint: TPoint
  ): TPoint[] => {
    if (vertexIndex === 0 && coordinates.length < 3) {
      return [closestPoint, closestPoint];
    }

    let newCoordinates = coordinates.slice();

    if (vertexIndex === 0) {
      newCoordinates[0] = closestPoint;
      newCoordinates[newCoordinates.length - 1] = closestPoint;
    } else {
      newCoordinates[vertexIndex] = closestPoint;
    }

    const isSamePoint =
      vertexIndex !== 0
        ? this._computing.isSamePoints(
            coordinates[vertexIndex],
            coordinates[vertexIndex - 1]
          )
        : this._computing.isSamePoints(
            coordinates[vertexIndex],
            coordinates[vertexIndex + 1]
          );

    if (isSamePoint) {
      newCoordinates =
        vertexIndex !== 0
          ? newCoordinates
              .slice(0, vertexIndex - 1)
              .concat(newCoordinates.slice(vertexIndex, newCoordinates.length))
          : [
              closestPoint,
              ...newCoordinates.slice(1, newCoordinates.length - 1),
              closestPoint,
            ];
    }

    return newCoordinates;
  };
}
