import { Injectable } from '@angular/core';
import { Polygon } from 'yandex-maps';
import { IPointActions } from '../models/interfaces/point-actions.interface';
import { PolygonsStore } from '../stores/polygons.store';

@Injectable({
  providedIn: 'root',
})
export class MapsService {
  private _map: any;

  private _drawing = false;
  private _polyline: any | null = null;
  // private _dash: any | null = null;
  // private _placemark: any | null = null;
  private _selected: Polygon | null = null;

  private readonly YANDEX_MAPS = (window as any).ymaps;

  constructor(private readonly _polygonsStore: PolygonsStore) {}

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
    });
  }

  setSelectedState(polygon: Polygon): void {
    const isSame =
      (polygon.properties.get('id') as never as number) ===
      (this._selected?.properties.get('id') as never as number);

    if (this._selected && !isSame) {
      this._selected.editor.stopEditing();
    }

    if (isSame) {
      this._selected?.editor.stopEditing();
      this._selected = null;
    } else {
      this._selected = polygon;
      this._selected.editor.startEditing();
    }
  }

  setDrawingState(): void {
    if (!this._drawing && this._selected) {
      this.setSelectedState(this._selected);
    }

    this._drawing = !this._drawing;

    this._drawing ? this._startDrawingPolygon() : this._endDrawingPolygon();
  }

  private _startDrawingPolygon() {
    this._polyline = new this.YANDEX_MAPS.Polyline(
      [],
      {},
      {
        strokeColor: '#0000FF', // Цвет линии
        strokeWidth: 3, // Толщина линии
        editorMenuManager: (actions: IPointActions[]) => {
          this._drawing = false;
          const isPolyLineStartOrEnd = !!actions.find(
            (action) => action.title === 'Продолжить'
          );

          if (isPolyLineStartOrEnd) {
            actions.push({
              title: 'Замкнуть полигон',
              onClick: () => this._endDrawingPolygon(),
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

  private _endDrawingPolygon(): void {
    const coordinates = this._polyline.geometry.getCoordinates();

    if (coordinates.length >= 3) {
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
      polygon.properties.set({ id, new: true });

      this._polygonsStore.create(polygon);
      this._map.geoObjects.add(polygon);

      polygon.events.add('click', (e: any) =>
        this.setSelectedState(e.originalEvent.target)
      );

      this.setSelectedState(polygon);

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
