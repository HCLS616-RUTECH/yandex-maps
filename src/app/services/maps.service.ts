import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MapsService {
  private _map: any;

  private _drawing = false;
  private _polyline: any | null = null;

  private readonly YANDEX_MAPS = (window as any).ymaps;

  constructor() {}

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

  setDrawingState(): void {
    this._drawing = !this._drawing;

    this._drawing ? this._startDrawingPolygon() : this._finishDrawingPolygon();
  }

  private _startDrawingPolygon() {
    this._polyline = new this.YANDEX_MAPS.Polyline(
      [],
      {},
      {
        strokeColor: '#0000FF', // Цвет линии
        strokeWidth: 3, // Толщина линии
      }
    );

    this._map.geoObjects.add(this._polyline);
    this._polyline.editor.startEditing();

    this._map.events.add('click', this._onMapClick);
  }

  private _finishDrawingPolygon(): void {
    this._map.events.remove('click', this._onMapClick);

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

      this._map.geoObjects.remove(this._polyline);
      this._polyline = null;
      this._map.geoObjects.add(polygon);
    }
  }

  private _onMapClick = (e: any): void => {
    if (!this._polyline) {
      return;
    }

    const coords = e.get('coords');
    this._polyline.geometry.setCoordinates([
      ...this._polyline.geometry.getCoordinates(),
      coords,
    ]);
  };

  // Обработчик клика по полигону
  // private _onPolygonClick(e) {
  //   // Например, при клике по полигону выводим сообщение и изменяем его цвет
  //   alert('Полигон был нажат!');
  //
  //   // Меняем цвет заливки и обводки полигона
  //   polygon.options.set({
  //     fillColor: '#FF000088', // Новый цвет заливки
  //     strokeColor: '#00FF00'  // Новый цвет обводки
  //   });
  // }
}
