import { take } from 'rxjs';
import { Polygon } from 'yandex-maps';
import { TActionState } from '../../../models/types/action-state.type';
import { ActionStore } from '../../../stores/action.store';
import { ChangesStore } from '../../../stores/changes.store';
import { MapSourcesStore } from '../../../stores/map-sources.store';
import { MapStore } from '../../../stores/map.store';
import { SelectedStore } from '../../../stores/selected.store';
import { SettingsStore } from '../../../stores/settings.store';
import { MainManager } from '../../main.manager';
import { MainHandlersExtension } from './main.handlers.extension';
import { IntersectionsExtension } from './main.intersections.extension';
import { PolygonExtension } from './main.polygon.extension';
import { PolylineExtension } from './main.polyline.extension';

export class MainActionsExtension {
  constructor(
    private readonly _main: MainManager,
    private readonly _polyline: PolylineExtension,
    private readonly _polygon: PolygonExtension,
    private readonly _handlers: MainHandlersExtension,
    private readonly _intersections: IntersectionsExtension,
    private readonly _settings: SettingsStore,
    private readonly _sources: MapSourcesStore,
    private readonly _action: ActionStore,
    private readonly _changes: ChangesStore,
    private readonly _selected: SelectedStore,
    private readonly _map: MapStore
  ) {}

  get produce(): Record<TActionState, () => void> {
    return {
      DELETE_POLYGON: this._deletePolygon,
      DRAG_POLYGON: this._dragPolygon,
      DRAWING_POLYLINE: this._drawPolyline,
      EDITING_POLYGON: this._editPolygon,
      DRAWING_POLYGON: this._drawPolygon,
      EMPTY: () => {},
    };
  }

  private _drawPolygon = (): void => {
    this._selected.clear();
    this._polyline.clear(this._handlers.draw);

    this._action.state = 'DRAWING_POLYGON';

    switch (this._action.state) {
      case 'DRAWING_POLYGON':
        this._polygon.startDrawing(this._handlers.draw);

        this._polygon.emitter$.pipe(take(1)).subscribe({
          next: (polygon: any) => this._initNewPolygon(polygon),
        });
        break;
      default:
        this._polygon.stopDrawing(this._handlers.draw);
    }
  };

  private _drawPolyline = (): void => {
    this._selected.clear();
    this._polygon.clear(this._handlers.draw);

    this._action.state = 'DRAWING_POLYLINE';

    switch (this._action.state) {
      case 'DRAWING_POLYLINE':
        this._polyline.startDrawing(this._handlers.draw);

        this._polyline.emitter$.pipe(take(1)).subscribe({
          next: (polygon: any) => this._initNewPolygon(polygon),
        });
        break;
      default:
        this._polyline.stopDrawing(this._handlers.draw);
    }
  };

  private _editPolygon = (): void => {
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
  };

  private _deletePolygon = (): void => {
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
  };

  private _dragPolygon = (): void => {
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
  };

  initPolygonActions = (polygon: Polygon): void => {
    polygon.events.add('click', (e: any) => {
      this._selected.state = e.originalEvent.target;
      if (!this._selected.state && this._action.state === 'EDITING_POLYGON') {
        e.originalEvent.target.editor.stopEditing();
        this._action.state = 'EMPTY';
      }
    });

    polygon.events.add('geometrychange', this._handlers.geometryChange);

    polygon.events.add(
      'dragstart',
      () => (this._selected.manipulations = { drag: true })
    );

    polygon.events.add('dragend', this._handlers.dragend);
  };

  private _initNewPolygon = (polygon: any): void => {
    if (polygon) {
      const id = polygon.properties.get('id') as string;

      this._changes.create(polygon);

      this.initPolygonActions(polygon);

      this._selected.state = polygon;
      this._main.setAction('EDITING_POLYGON');

      this._sources.add.polygon.all(id, polygon);
      this._sources.add.polygon.visible(id, polygon);

      this._intersections.check(polygon);
    }
  };
}
