import { Injectable, signal } from '@angular/core';
import { debounceTime, Subject, switchMap, take } from 'rxjs';
import { Polygon } from 'yandex-maps';
import { ISelectedParams } from '../models/interfaces/selected-params.interface';
import { IZone } from '../models/interfaces/zone.interface';
import { TActionState } from '../models/types/action-state.type';
import { TBbox } from '../models/types/bbox.type';
import { TChangedParam } from '../models/types/changed-param.type';
import { TPoint } from '../models/types/point.type';
import { ActionStore } from '../stores/action.store';
import { ChangesStore } from '../stores/changes.store';
import { SelectedStore } from '../stores/selected.store';
import { VertexCountStore } from '../stores/vertex-count.store';
import { ComputingService } from './computing.service';
import { DebuggerService } from './debugger.service';
import { IntersectionsExtension } from './extends/map.intersections.extension';
import { MapParamsExtension } from './extends/map.params.extension';
import { PolygonExtension } from './extends/map.polygon.extension';
import { PolylineExtension } from './extends/map.polyline.extension';
import { MapsHttpService } from './maps.http.service';

// TODO: 1. Бага с цветом при перетаскивании (быстро нажимать)                                      -
// TODO: 2. Отображать факт наличия пересечений                                                     -
// TODO: 3. editorMenuManager: завершить рисование для полигона, удалить добавить внутренний контур -
// TODO: 4. Исчезновение vertexCount при перетаскивании полигона                                    -
// TODO: 5. Почему то может не срабатывать прилипание (замечено по отношению к нижней зоне)         +
// TODO: 6. Переделать горячие клавиши                                                              -
// TODO: 7. Бага с анимацией изменений                                                              +
// TODO: 8. Декомпозировать основной сервис                                                         -
// TODO: 9. Кэш                                                                                     -

@Injectable({
  providedIn: 'root',
})
export class MapsService {
  yandexVersion = signal<string>('0');

  private _map: any;
  private _polyline: any | PolylineExtension;
  private _polygon: any | PolygonExtension;
  private _intersections: any | IntersectionsExtension;

  private readonly _polygons = new Map<string, any>();
  private readonly _visiblePolygons = new Map<string, any>();
  private readonly _zones = new Map<string, IZone>();

  private readonly _request$ = new Subject<TBbox>();

  private readonly YANDEX_MAPS = (window as any).ymaps;

  constructor(
    private readonly _debugger: DebuggerService,
    private readonly _http: MapsHttpService,
    private readonly _computing: ComputingService,
    private readonly _changes: ChangesStore,
    private readonly _action: ActionStore,
    private readonly _selected: SelectedStore,
    private readonly _vertexCount: VertexCountStore,
    private readonly _params: MapParamsExtension
  ) {
    this.YANDEX_MAPS.ready(() => {
      this.yandexVersion.set(this.YANDEX_MAPS.meta.version);

      const { center, zoom, controls, maxZoom, minZoom } = this._params.map;

      this._map = new this.YANDEX_MAPS.Map(
        'map',
        { center, zoom, controls },
        { minZoom, maxZoom }
      );

      this._polyline = new PolylineExtension(
        this._map,
        this.YANDEX_MAPS,
        this._action,
        this._vertexCount,
        this._computing,
        this._params
      );

      this._polygon = new PolygonExtension(
        this._map,
        this.YANDEX_MAPS,
        this._action,
        this._vertexCount,
        this._computing,
        this._params
      );

      this._intersections = new IntersectionsExtension(
        this._map,
        this.YANDEX_MAPS,
        this._computing,
        this._params,
        this._selected,
        this._action,
        this._polygons
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
    if (event.key === 'Escape') {
      this._polyline.clear(this._drawingHandler);

      this._polygon.clear(this._drawingHandler);

      this._vertexCount.clear();

      this._selected.clear();
    }

    if (/[zя]/i.test(event.key)) {
      return this.setActionState('DRAWING_POLYLINE');
    }

    if (/[xч]/i.test(event.key)) {
      return this.setActionState('DRAWING_POLYGON');
    }

    if (/[dв]/i.test(event.key)) {
      if (this._selected.state) {
        this.setActionState('DRAG_POLYGON');
      }
      return;
    }

    if (/[cс]/i.test(event.key)) {
      if (this._selected.state) {
        this.setActionState('EDITING_POLYGON');
      }
      return;
    }

    if (/[sы]/i.test(event.key)) {
      if (this._selected.state) {
        this.setActionState('DELETE_POLYGON');
      }
      return;
    }

    if (event.key === 'Delete') {
      if (this._selected.state) {
        this.setActionState('DELETE_POLYGON');
      }
      return;
    }

    if (event.key === 'Enter') {
      if (this._action.state === 'EMPTY' && this._selected.state) {
        return this.setActionState('EDITING_POLYGON');
      }

      return this.setActionState(this._action.state);
    }

    if (/[qй]/i.test(event.key)) {
      return this.updateMap();
    }
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
    this._vertexCount.clear();
    this._selected.clear();
    this._polyline.clear(this._drawingHandler);
    this._polygon.clear(this._drawingHandler);

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

  setNewParams = (params: Partial<ISelectedParams>): void => {
    if (!this._selected.state) {
      return;
    }

    this._selected.params = params;

    this._selected.changes
      ? this._changes.edit(this._selected.state)
      : this._changes.remove(this._selected.params!.id, 'edited');
  };

  clearChangedParams = (params: TChangedParam[]): void => {
    if (!this._selected.state) {
      return;
    }

    this._selected.changes = { params, action: 'clear' };

    this._selected.changes
      ? this._changes.edit(this._selected.state)
      : this._changes.remove(this._selected.params!.id, 'edited');
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

      const polygon = new this.YANDEX_MAPS.Polygon(
        zone.coordinates,
        {
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
        },
        {
          ...this._params.stroke,
          fillColor: zone.color,
        }
      );

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

    this._params.animatePolygons(newPolygons);

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
      this._params.stopDrag(selected);
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
      ? this._params.startDrag(selected)
      : this._params.stopDrag(selected);
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

    polygon.events.add('dragstart', () => (this._selected.drag = true));

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
  };

  private _geometryChangeHandler = (event: any): void => {
    if (this._selected.drag) {
      return;
    }

    if (this._selected.computing) {
      return;
    }

    this._selected.computing = true;

    const { oldCoordinates, newCoordinates } =
      event.originalEvent.originalEvent.originalEvent;

    const vertexIndex = this._computing.findVertexIndex(
      oldCoordinates[0],
      newCoordinates[0]
    );

    this._checkPoint(vertexIndex);

    this._selected.bounds = this._selected.bounds;

    this._intersections.check(this._selected.state);

    this._selected.computing = false;
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

      this._selected.coordinates =
        this._computing.deleteSamePoints(newCoordinates);
    }

    this._intersections.check(this._selected.state);

    this._checkIsDefaultCoordinates();

    this._selected.drag = false;
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

    this._vertexCount.state = coordinates.length;

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
          this._selected.coordinates = checkResult;
          break;
      }
    }

    this._checkIsDefaultCoordinates();
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

        this._vertexCount.state = coordinates.length;
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

      this._vertexCount.state = coordinates.length;
    }

    return newCoordinates;
  };

  private _checkIsDefaultCoordinates = (): void => {
    if (!this._selected.state) {
      return;
    }

    const defaultParams = this._selected.state.properties.get(
      'default'
    ) as Omit<IZone, 'id'>;
    const isDefaultCoordinates = this._computing.checkIsSameCoordinates(
      this._selected.coordinates,
      defaultParams.coordinates[0]
    );

    if (isDefaultCoordinates) {
      this._selected.changes = { params: ['coordinates'], action: 'clear' };
      this._changes.remove(this._selected.params!.id, 'edited');
    } else {
      this._selected.changes = { params: ['coordinates'], action: 'add' };
      this._changes.edit(this._selected.state);
    }
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
