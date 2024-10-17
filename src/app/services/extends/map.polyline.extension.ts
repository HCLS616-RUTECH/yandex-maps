import { Observable, Subject } from 'rxjs';
import { IPointActions } from '../../models/interfaces/point-actions.interface';
import { TPoint } from '../../models/types/point.type';
import { ActionStore } from '../../stores/action.store';
import { MapParamsExtension } from './map.params.extension';

export class PolylineExtension {
  private _polyline: any | null = null;

  private readonly _emitter$ = new Subject<any>();

  constructor(
    private readonly _map: any,
    private readonly YANDEX_MAPS: any,
    private readonly _params: MapParamsExtension
  ) {}

  get state(): any | null {
    return this._polyline;
  }

  get emitter$(): Observable<any> {
    return this._emitter$.asObservable();
  }

  get coordinates(): TPoint[] {
    return this._polyline?.geometry.getCoordinates() ?? [];
  }

  set coordinates(coordinates: TPoint[]) {
    this._polyline?.geometry.setCoordinates(coordinates);

    // Чинит багу с точкой, которая отрывается от вершины при логике с одинаковыми вершинами
    this._polyline?.editor.stopEditing();
    this._polyline?.editor.startEditing();

    this._polyline?.editor.stopDrawing();
    this._polyline?.editor.startDrawing();
  }

  startDrawing(
    action: ActionStore,
    newVertexHandler: (event: any) => void,
    changeHandler: (event: any) => void
  ): void {
    this._polyline = new this.YANDEX_MAPS.Polyline(
      [],
      {},
      {
        ...this._params.strokeSelected,
        editorMenuManager: (actions: IPointActions[]) => {
          console.log(actions);
          actions = actions.filter((action) => action.title !== 'Завершить');

          const isPolyLineStartOrEnd = !!actions.find(
            (action) => action.title === 'Продолжить'
          );
          const { length } = this._polyline.geometry.getCoordinates();

          if (isPolyLineStartOrEnd && length > 2) {
            actions.push({
              title: 'Замкнуть полигон',
              onClick: () => {
                action.state = 'EMPTY';
                this.stopDrawing(newVertexHandler, changeHandler);
              },
            });
          }

          return actions;
        },
      }
    );

    this._polyline.editor.events.add('vertexadd', newVertexHandler);
    this._polyline.geometry.events.add('change', changeHandler);

    this._map.geoObjects.add(this._polyline);
    this._polyline.editor.startEditing();
    this._polyline.editor.startDrawing();
  }

  stopDrawing(
    newVertexHandler: (event: any) => void,
    changeHandler: (event: any) => void
  ): void {
    const coordinates = this._polyline.geometry.getCoordinates();

    if (coordinates.length > 2) {
      coordinates.push(coordinates[0]);

      const polygon = new this.YANDEX_MAPS.Polygon(
        [coordinates],
        {},
        {
          ...this._params.strokeSelected,
          fillColor: this._params.baseColor,
        }
      );

      this._map.geoObjects.add(polygon);

      const id = this._params.createPolygonId(polygon);
      polygon.properties.set({
        id,
        name: `Новая зона ${id}`,
        bbox: polygon.geometry.getBounds(),
        new: true,
      });

      this._emitter$.next(polygon);
    } else {
      this._emitter$.next(null);
    }

    this.clear(newVertexHandler, changeHandler);
  }

  clear(
    newVertexHandler: (event: any) => void,
    changeHandler: (event: any) => void
  ): void {
    this._polyline.editor.stopEditing();
    this._polyline.editor.stopDrawing();
    this._polyline.events.remove('vertexadd', newVertexHandler);
    this._polyline.events.remove('change', changeHandler);
    this._map.geoObjects.remove(this._polyline);
    this._polyline = null;
  }
}
