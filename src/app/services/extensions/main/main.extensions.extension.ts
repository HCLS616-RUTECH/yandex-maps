import { ActionStore } from '../../../stores/action.store';
import { ChangesStore } from '../../../stores/changes.store';
import { MapSourcesStore } from '../../../stores/map-sources.store';
import { MapStore } from '../../../stores/map.store';
import { SelectedStore } from '../../../stores/selected.store';
import { SettingsStore } from '../../../stores/settings.store';
import { VertexesStore } from '../../../stores/vertexes.store';
import { ComputingService } from '../../computing.service';
import { MainManager } from '../../main.manager';
import { MainActionsExtension } from './main.actions.extension';
import { MainHandlersExtension } from './main.handlers.extension';
import { IntersectionsExtension } from './main.intersections.extension';
import { MainKeyboardExtension } from './main.keyboard.extension';
import { PolygonExtension } from './main.polygon.extension';
import { PolylineExtension } from './main.polyline.extension';

export class MainExtensions {
  private readonly _polyline: PolylineExtension;
  private readonly _polygon: PolygonExtension;
  private readonly _intersections: IntersectionsExtension;
  private readonly _keyboard: MainKeyboardExtension;
  private readonly _handlers: MainHandlersExtension;
  private readonly _actions: MainActionsExtension;

  constructor(
    private readonly _main: MainManager,
    private readonly YANDEX_MAPS: any,
    private readonly _map: MapStore,
    private readonly _action: ActionStore,
    private readonly _vertexes: VertexesStore,
    private readonly _computing: ComputingService,
    private readonly _settings: SettingsStore,
    private readonly _selected: SelectedStore,
    private readonly _sources: MapSourcesStore,
    private readonly _changes: ChangesStore
  ) {
    this._polyline = new PolylineExtension(
      this.YANDEX_MAPS,
      this._map,
      this._action,
      this._vertexes,
      this._computing,
      this._settings,
      this._sources
    );

    this._polygon = new PolygonExtension(
      this.YANDEX_MAPS,
      this._map,
      this._action,
      this._vertexes,
      this._computing,
      this._settings,
      this._sources
    );

    this._intersections = new IntersectionsExtension(
      this.YANDEX_MAPS,
      this._map,
      this._computing,
      this._settings,
      this._selected,
      this._action,
      this._sources
    );

    this._keyboard = new MainKeyboardExtension(
      this._main,
      this._action,
      this._selected
    );

    this._handlers = new MainHandlersExtension(
      this._main,
      this._polyline,
      this._polygon,
      this._intersections,
      this._computing,
      this._sources,
      this._changes,
      this._action,
      this._selected
    );

    this._actions = new MainActionsExtension(
      this._main,
      this._polyline,
      this._polygon,
      this._handlers,
      this._intersections,
      this._settings,
      this._sources,
      this._action,
      this._changes,
      this._selected,
      this._map
    );
  }

  get polyline(): PolylineExtension {
    return this._polyline;
  }

  get polygon(): PolygonExtension {
    return this._polygon;
  }

  get intersections(): IntersectionsExtension {
    return this._intersections;
  }

  get keyboard(): MainKeyboardExtension {
    return this._keyboard;
  }

  get handlers(): MainHandlersExtension {
    return this._handlers;
  }

  get actions(): MainActionsExtension {
    return this._actions;
  }
}
