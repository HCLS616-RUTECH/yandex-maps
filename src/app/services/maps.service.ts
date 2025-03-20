import { Injectable } from '@angular/core';
import { debounceTime, Subject, switchMap, take } from 'rxjs';
import { Polygon } from 'yandex-maps';
import { Queue } from '../models/classes/queue';
import { IOptions } from '../models/interfaces/options.interface';
import { IZone } from '../models/interfaces/zone.interface';
import { TActionState } from '../models/types/action-state.type';
import { TBbox } from '../models/types/bbox.type';
import { TCache } from '../models/types/cache.type';
import { TChangedParam } from '../models/types/changed-param.type';
import { TPoint } from '../models/types/point.type';
import { ActionStore } from '../stores/action.store';
import { ChangesStore } from '../stores/changes.store';
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

// TODO: 1. Бага с цветом при перетаскивании (быстро нажимать)                                      -
// TODO: 2. Отображать факт наличия пересечений                                                     -
// TODO: 3. editorMenuManager: завершить рисование для полигона, удалить добавить внутренний контур -
// TODO: 4. Исчезновение vertexCount при перетаскивании полигона                                    -
// TODO: 5. Переделать горячие клавиши                                                              -
// TODO: 6. Декомпозировать основной сервис                                                         -

@Injectable({
  providedIn: 'root',
})
export class MapsService {
  private _map: any;
  private _polyline: any | PolylineExtension;
  private _polygon: any | PolygonExtension;
  private _intersections: any | IntersectionsExtension;
  private _keyboard: any | MapKeyboardExtension;

  private readonly _polygons = new Map<string, any>();
  private readonly _visiblePolygons = new Map<string, any>();
  private readonly _zones = new Map<string, IZone>();

  private readonly _request$ = new Subject<TBbox>();

  private readonly YANDEX_MAPS = (window as any).ymaps;

  constructor(
    private readonly _http: MapsHttpService,
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

      const { center, zoom, controls, maxZoom, minZoom } = this._settings.map;

      this._map = new this.YANDEX_MAPS.Map(
        'map',
        { center, zoom, controls },
        { minZoom, maxZoom }
      );

      this._polyline = new PolylineExtension(
        this._map,
        this.YANDEX_MAPS,
        this._action,
        this._vertexes,
        this._computing,
        this._settings
      );

      this._polygon = new PolygonExtension(
        this._map,
        this.YANDEX_MAPS,
        this._action,
        this._vertexes,
        this._computing,
        this._settings
      );

      this._intersections = new IntersectionsExtension(
        this._map,
        this.YANDEX_MAPS,
        this._computing,
        this._settings,
        this._selected,
        this._action,
        this._polygons
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
          next: (zones) => this._addNewPolygons(zones),
        });

      this._map.events.add('boundschange', (e: any) =>
        this._request$.next(this._map.getBounds())
      );

      // this._map.events.add('click', (event: any) =>
      //   console.log(event.get('coords'))
      // );

      this._request$.next(this._map.getBounds());

      document.querySelector('.ymaps-2-1-79-map-copyrights-promo')?.remove();
    });
  }

  keyboardHandler = (event: KeyboardEvent): void => {
    this._keyboard.handler(event);
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
    this._polygons.forEach((polygon) => this._map.geoObjects.remove(polygon));
    this._polygons.clear();

    this._visiblePolygons.clear();

    this._changes.state.new.forEach((polygon) =>
      this._map.geoObjects.remove(polygon)
    );
    this._changes.clear();

    this._intersections.clear();

    this.clearShapes();

    this._action.state = 'EMPTY';

    this._request$.next(this._map.getBounds());
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

    const defaultParams = this._selected.defaultParams!;

    this._selected.params = params.reduce(
      (acc, key) => ({ ...acc, [key]: defaultParams[key] }),
      {}
    );

    this._selected.changes.length
      ? this._changes.edit(this._selected.state)
      : this._changes.remove(this._selected.params!.id, 'edited');
  };

  clearShapes = (): void => {
    this._polyline.clear(this._drawingHandler);
    this._polygon.clear(this._drawingHandler);
    this._selected.clear();
  };

  private _addNewPolygons(zones: IZone[]): void {
    const changes = this._changes.state;
    this._zones.clear();

    const newPolygons: Polygon[] = [];

    for (let zone of zones) {
      if (changes.deleted.has(zone.id)) {
        continue;
      }

      this._zones.set(zone.id, zone);

      const visiblePolygon = this._visiblePolygons.get(zone.id);

      if (visiblePolygon) {
        // Чинит багу яндекс карт, при которой не до конца отрисовывается полигон, при движении экрана по картам
        visiblePolygon.options.set(
          'fillColor',
          visiblePolygon.options.get('fillColor')
        );
        continue;
      }

      if (this._polygons.has(zone.id)) {
        this._visiblePolygons.set(zone.id, this._polygons.get(zone.id));
        this._map.geoObjects.add(this._polygons.get(zone.id));
        newPolygons.push(this._polygons.get(zone.id));
        continue;
      }

      const options: IOptions = {
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

      const polygon = new this.YANDEX_MAPS.Polygon(zone.coordinates, options, {
        ...this._settings.stroke,
        fillColor: zone.color,
      });

      this._initPolygonActions(polygon);

      newPolygons.push(polygon);
      this._polygons.set(zone.id, polygon);
      this._visiblePolygons.set(zone.id, this._polygons.get(zone.id));
      this._map.geoObjects.add(polygon);
    }

    this._visiblePolygons.forEach((polygon, id) => {
      if (
        !this._zones.has(id) &&
        !changes.new.has(id) &&
        !changes.edited.has(id)
      ) {
        this._map.geoObjects.remove(polygon);
        this._visiblePolygons.delete(id);
      }
    });

    const screenBbox = this._map.getBounds();

    changes.edited.forEach((polygon, id) => {
      const isBboxesIntersected = this._computing.isBBoxesIntersected(
        polygon.properties.get('bbox') as never as TBbox,
        screenBbox
      );

      if (isBboxesIntersected && this._visiblePolygons.has(id)) {
        return;
      }

      if (!isBboxesIntersected && this._visiblePolygons.has(id)) {
        this._map.geoObjects.remove(polygon);
        this._visiblePolygons.delete(id);
      }

      if (isBboxesIntersected && !this._visiblePolygons.has(id)) {
        this._visiblePolygons.set(id, this._polygons.get(id));
        this._map.geoObjects.add(polygon);
        newPolygons.push(polygon);
      }
    });

    changes.new.forEach((polygon, id) => {
      const isBboxesIntersected = this._computing.isBBoxesIntersected(
        polygon.properties.get('bbox') as never as TBbox,
        screenBbox
      );

      if (!isBboxesIntersected && this._visiblePolygons.has(id)) {
        this._map.geoObjects.remove(polygon);
        this._visiblePolygons.delete(id);
      }

      if (isBboxesIntersected && !this._visiblePolygons.has(id)) {
        this._visiblePolygons.set(id, this._polygons.get(id));
        this._map.geoObjects.add(polygon);
        newPolygons.push(polygon);
      }
    });

    this._settings.animatePolygons(newPolygons);

    this._intersections.checkBounds(screenBbox);
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

      this._polygons.set(id, polygon);
      this._visiblePolygons.set(id, polygon);

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

    this._polygons.delete(id);
    this._visiblePolygons.delete(id);

    this._changes.delete(selected);

    this._map.geoObjects.remove(selected);

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

    const polygons = Array.from(this._polygons.values());

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

  // private _initPlaceMark(): void {
  //   this._placemark = new this.YANDEX_MAPS.Placemark(
  //     [0, 0],
  //     {},
  //     {
  //       cursor: 'grab',
  //       iconLayout: 'default#imageWithContent',
  //       iconContentLayout: this.YANDEX_MAPS.templateLayoutFactory.createClass(
  //         '<div style="width: 15px; height: 15px; background-color: white; border: 1px solid black; border-radius: 50%;"></div>'
  //       ),
  //       iconImageSize: [15, 15],
  //       iconImageOffset: [-10, -10],
  //     }
  //   );
  //   this._map.geoObjects.add(this._placemark);
  //   this._map.events.add('mousemove', this._movePlaceMark);
  //   this._placemark.events.add('click', this._onPointClick);
  // }
  //
  // private _movePlaceMark = (e: any): void => {
  //   const coords = e.get('coords');
  //   this._placemark.geometry.setCoordinates(coords);
  // };

  // private _initDash(): void {
  //   this._dash = new this.YANDEX_MAPS.Polyline(
  //     [
  //       [0, 0],
  //       [0, 0],
  //     ],
  //     {},
  //     {
  //       strokeColor: '#00000088',
  //       strokeWidth: 3,
  //       strokeStyle: 'dash',
  //       editorMaxPoints: 2,
  //       // editorMenuManager: function (items) {
  //       //   items.push({
  //       //     title: 'Удалить линию',
  //       //     onClick: function () {
  //       //       myMap.geoObjects.remove(myPolyline);
  //       //     },
  //       //   });
  //       //   return items;
  //       // },
  //     }
  //   );
  //   this._map.geoObjects.add(this._dash);
  //   this._map.events.add('mousemove', this._moveDash);
  // }
  //
  // private _moveDash = (e: any): void => {
  //   const coordinates = this._polyline.geometry.getCoordinates();
  //
  //   if (!coordinates.length) {
  //     return;
  //   }
  //
  //   const lastPoint = coordinates[coordinates.length - 1];
  //   const dynamicPoint = e.get('coords');
  //
  //   this._dash.geometry.setCoordinates([lastPoint, dynamicPoint]);
  // };

  // private _onPointClick = (e: any): void => {
  //   if (!this._polyline) {
  //     return;
  //   }
  //
  //   console.log([...this._polyline.geometry.getCoordinates(), e.get('coords')]);
  //
  //   this._polyline.geometry.setCoordinates([
  //     ...this._polyline.geometry.getCoordinates(),
  //     e.get('coords'),
  //   ]);
  // };
  //

  // private _updateLastPoint = (e: any): void => {
  //   if (!this._drawing) {
  //     return;
  //   }
  //
  //   const coords = this._snapToGrid(e.get('coords'));
  //
  //   const updatedCoords = this._polyline.geometry.getCoordinates().slice();
  //   updatedCoords[updatedCoords.length - 1] = coords;
  //   this._polyline.geometry.setCoordinates(updatedCoords);
  // };
  //
  // private _snapToGrid = (coords: [number, number]): [number, number] => {
  //   const gridSize = 0.01; // Размер сетки (чем меньше, тем ближе примагничивание)
  //   const snappedLat = Math.round(coords[0] / gridSize) * gridSize;
  //   const snappedLng = Math.round(coords[1] / gridSize) * gridSize;
  //   return [snappedLat, snappedLng];
  // };
}
