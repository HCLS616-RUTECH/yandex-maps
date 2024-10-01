import { Injectable } from '@angular/core';
import { take } from 'rxjs';
import { Polygon } from 'yandex-maps';
import { IPointActions } from '../models/interfaces/point-actions.interface';
import { IZone } from '../models/interfaces/zone.interface';
import { TActionState } from '../models/types/action-state.type';
import { TBbox } from '../models/types/bbox.type';
import { ChangesStore } from '../stores/changes.store';
import { SelectedStore } from '../stores/selected.store';
import { MapsHttpService } from './maps.http.service';

@Injectable({
  providedIn: 'root',
})
export class MapsService {
  private _map: any;

  private _action: TActionState = 'EMPTY';
  private _polyline: any | null = null;
  private _polygon: any | null = null;
  // private _dash: any | null = null;
  // private _placemark: any | null = null;

  private _isAddingPolygons = false;

  private readonly _polygons = new Map<string, any>();
  private readonly YANDEX_MAPS = (window as any).ymaps;

  constructor(
    private readonly _http: MapsHttpService,
    private readonly _changesStore: ChangesStore,
    private readonly _selectedStore: SelectedStore
  ) {}

  initMap(): void {
    this.YANDEX_MAPS.ready(() => {
      this._map = new this.YANDEX_MAPS.Map(
        'map',
        {
          center: [55.76, 37.64],
          zoom: 10,
        },
        { minZoom: 4, maxZoom: 14 }
      );

      this._map.controls.add('zoomControl', {
        size: 'small',
      });

      this._map.events.add('boundschange', (e: any) =>
        this._getZones(this._map.getBounds())
      );

      this._getZones(this._map.getBounds());
    });
  }

  setActionState(state: TActionState): void {
    switch (state) {
      case 'DRAWING_POLYLINE':
        this._drawingPolyline();
        break;
      case 'DRAWING_POLYGON':
        this._drawingPolygon();
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

  updateZones(): void {
    this._polygons.forEach((polygon) => this._map.geoObjects.remove(polygon));
    this._polygons.clear();
    this._changesStore.changes.new.forEach((polygon) =>
      this._map.geoObjects.remove(polygon)
    );
    this._changesStore.clearChanges();
    this._getZones(this._map.getBounds());
  }

  saveChanges(): void {
    const body = this._changesStore.requestBody;

    this._http.saveChanges(body).pipe(take(1)).subscribe();
  }

  private _getZones(bbox: TBbox): void {
    this._http
      .getZones(bbox)
      .pipe(take(1))
      .subscribe({
        next: (zones) => this._addNewPolygons(zones),
      });
  }

  private _addNewPolygons(zones: IZone[]): void {
    const { deleted } = this._changesStore.changes;

    const newPolygons: Polygon[] = [];

    this._isAddingPolygons = true;

    for (let zone of zones) {
      if (deleted.has(zone.id)) {
        continue;
      }

      if (this._polygons.has(zone.id)) {
        // Чинит багу с яндекс карт, при которой не до конца отрисовывается полигон, при движении экрана по картам
        this._polygons
          .get(zone.id)
          .geometry.setCoordinates(
            this._polygons.get(zone.id).geometry.getCoordinates()
          );
        continue;
      }

      const polygon = new this.YANDEX_MAPS.Polygon(
        zone.coordinates,
        { id: zone.id, name: zone.name, new: false },
        {
          fillColor: zone.color,
          strokeColor: '#0000FF',
          strokeWidth: 1,
        }
      );

      this._initPolygonActions(polygon);

      newPolygons.push(polygon);
      this._polygons.set(zone.id, polygon);
      this._map.geoObjects.add(polygon);
    }

    this._isAddingPolygons = false;
  }

  private _drawingPolygon(): void {
    const selected = this._selectedStore.selected;
    if (selected) {
      this._selectedStore.setSelectedState(selected);
    }

    this._action = this._checkActionState('DRAWING_POLYGON');

    this._action === 'DRAWING_POLYGON'
      ? this._startDrawingPolygon()
      : this._endDrawingPolygon();
  }

  private _startDrawingPolygon(): void {
    this._polygon = new this.YANDEX_MAPS.Polygon(
      [],
      {},
      {
        fillColor: '#FFFF0088', // Цвет заливки
        strokeColor: '#0000FF', // Цвет обводки
        strokeWidth: 3, // Ширина обводки
      }
    );

    this._map.geoObjects.add(this._polygon);
    this._polygon.editor.startDrawing();
  }

  private _endDrawingPolygon(): void {
    const coordinates = this._polygon.geometry.getCoordinates()[0];

    if (coordinates.length < 4) {
      this._polygon.editor.stopDrawing();
      this._map.geoObjects.remove(this._polygon);
      this._polygon = null;
      return;
    }

    this._polygon.options.set('fillColor', '#00FF0088');

    const id = this._getPolygonId(this._polygon);
    this._polygon.properties.set({ id, name: `Новая зона ${id}`, new: true });

    this._changesStore.create(this._polygon);

    this._initPolygonActions(this._polygon);

    this._selectedStore.setSelectedState(this._polygon);

    this._polygon.editor.stopDrawing();

    this.setActionState('EDITING_POLYGON');

    this._polygon = null;
  }

  private _drawingPolyline(): void {
    const selected = this._selectedStore.selected;
    if (selected) {
      this._selectedStore.setSelectedState(selected);
    }

    this._action = this._checkActionState('DRAWING_POLYLINE');

    this._action === 'DRAWING_POLYLINE'
      ? this._startDrawingPolyline()
      : this._endDrawingPolyline();
  }

  private _startDrawingPolyline(): void {
    this._polyline = new this.YANDEX_MAPS.Polyline(
      [],
      {},
      {
        strokeColor: '#0000FF', // Цвет линии
        strokeWidth: 3, // Толщина линии
        editorMenuManager: (actions: IPointActions[]) => {
          const isPolyLineStartOrEnd = !!actions.find(
            (action) => action.title === 'Продолжить'
          );
          const { length } = this._polyline.geometry.getCoordinates();

          if (isPolyLineStartOrEnd && length > 2) {
            actions.push({
              title: 'Замкнуть полигон',
              onClick: () => {
                this._action = 'EMPTY';
                this._endDrawingPolyline();
              },
            });
          }

          return actions;
        },
      }
    );

    this._map.geoObjects.add(this._polyline);
    this._polyline.editor.startEditing();
    this._polyline.editor.startDrawing();
  }

  private _endDrawingPolyline(): void {
    const coordinates = this._polyline.geometry.getCoordinates();

    if (coordinates.length > 2) {
      coordinates.push(coordinates[0]);

      const polygon = new this.YANDEX_MAPS.Polygon(
        [coordinates],
        {},
        {
          fillColor: '#00FF0088', // Цвет заливки
          strokeColor: '#0000FF', // Цвет обводки
          strokeWidth: 3, // Ширина обводки
        }
      );

      const id = this._getPolygonId(polygon);
      polygon.properties.set({ id, name: `Новая зона ${id}`, new: true });

      this._changesStore.create(polygon);
      this._map.geoObjects.add(polygon);

      this._initPolygonActions(polygon);

      this._selectedStore.setSelectedState(polygon);
      this.setActionState('EDITING_POLYGON');

      // this._map.events.add('mousemove', this._updateLastPoint);
      // this._placemark = new this.YANDEX_MAPS.Placemark([0, 0], {});
      // this._map.geoObjects.add(this._placemark);
      // this._map.events.add('mousemove', this._ppp);
    }

    // this._map.events.remove('click', this._onPointClick);
    // this._map.events.remove('mousemove', this._movePlaceMark);
    // this._placemark.events.remove('click', this._onPointClick);
    // this._map.events.remove('mousemove', this._moveDash);
    this._polyline.editor.stopEditing();
    this._polyline.editor.stopDrawing();
    this._map.geoObjects.remove(this._polyline);
    // this._map.geoObjects.remove(this._placemark);
    // this._map.geoObjects.remove(this._dash);

    this._polyline = null;
    // this._placemark = null;
    // this._dash = null;
  }

  private _editPolygon(): void {
    const selected = this._selectedStore.selected;
    if (!selected) {
      return;
    }

    this._action = this._checkActionState('EDITING_POLYGON');

    this._action === 'EDITING_POLYGON'
      ? selected.editor.startEditing()
      : selected.editor.stopEditing();
  }

  private _deletePolygon(): void {
    const selected = this._selectedStore.selected;
    if (!selected) {
      return;
    }

    this._polygons.delete(selected.properties.get('id') as never as string);
    this._changesStore.delete(selected);
    this._map.geoObjects.remove(selected);
  }

  private _dragPolygon(): void {
    const selected = this._selectedStore.selected;
    if (!selected) {
      return;
    }

    this._action = this._checkActionState('DRAG_POLYGON');

    if (this._action === 'DRAG_POLYGON') {
      // @ts-ignore
      selected.options.set('draggable', true);
      selected.options.set('fillColor', '#FF000088');
    } else {
      // @ts-ignore
      selected.options.set('draggable', false);
      selected.options.set('fillColor', '#00FF0088');
    }
  }

  private _initPolygonActions = (polygon: Polygon): void => {
    polygon.events.add('click', (e: any) => {
      this._selectedStore.setSelectedState(e.originalEvent.target);
      if (!this._selectedStore.selected && this._action === 'EDITING_POLYGON') {
        e.originalEvent.target.editor.stopEditing();
        this._action = 'EMPTY';
      }
    });

    polygon.geometry?.events.add('change', (e: any) => {
      if (!this._isAddingPolygons) {
        this._changesStore.edit(polygon);
      }
    });
  };

  private _getPolygonId(polygon: any): string {
    let id = '0';
    const keys = Object.keys(polygon);
    for (let i = 0; i < keys.length; i++) {
      if (keys[i].includes('id')) {
        id = (keys[i].match(/\d/g)?.join('') ?? '0') + polygon[keys[i]];
        i = keys.length;
      }
    }
    return id;
  }

  private _checkActionState(state: TActionState): TActionState {
    if (state === this._action) {
      return 'EMPTY';
    }

    return state;
  }

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
