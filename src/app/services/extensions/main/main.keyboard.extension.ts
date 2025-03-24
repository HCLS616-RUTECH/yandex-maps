import { ActionStore } from '../../../stores/action.store';
import { SelectedStore } from '../../../stores/selected.store';
import { MainManager } from '../../main.manager';

export class MainKeyboardExtension {
  private readonly _test = {
    global: {
      escape: (code: string) => code === 'Escape',
      enter: (code: string) => code === 'Enter',
      delete: (code: string) => code === 'Delete',
    },
    drawing: {
      polygon: (code: string) => code === 'KeyZ',
      polyline: (code: string) => code === 'KeyX',
    },
    editing: (code: string) => code === 'KeyC',
    drag: (code: string) => code === 'KeyD',
    delete: (code: string) => code === 'KeyQ',
    update: (code: string) => code === 'KeyW',
    cache: {
      back: (code: string) => code === 'ArrowLeft' && this._checkCache(),
      forward: (code: string) => code === 'ArrowRight' && this._checkCache(),
    },
  };

  constructor(
    private readonly _main: MainManager,
    private readonly _action: ActionStore,
    private readonly _selected: SelectedStore
  ) {}

  handler = ({ code, shiftKey }: KeyboardEvent): void => {
    if (this._test.global.escape(code)) {
      return this._main.clearShapes();
    }

    if (this._test.global.enter(code)) {
      if (this._action.state === 'EMPTY' && this._selected.state) {
        return this._main.setAction('EDITING_POLYGON');
      }

      return this._main.setAction(this._action.state);
    }

    if (this._test.global.delete(code)) {
      return this._main.setAction('DELETE_POLYGON');
    }

    if (!shiftKey) {
      return;
    }

    if (this._test.drawing.polygon(code)) {
      return this._main.setAction('DRAWING_POLYGON');
    }

    if (this._test.drawing.polyline(code)) {
      return this._main.setAction('DRAWING_POLYLINE');
    }

    if (this._test.editing(code)) {
      return this._main.setAction('EDITING_POLYGON');
    }

    if (this._test.drag(code)) {
      return this._main.setAction('DRAG_POLYGON');
    }

    if (this._test.delete(code)) {
      return this._main.setAction('DELETE_POLYGON');
    }

    if (this._test.update(code)) {
      return this._main.updateMap();
    }

    if (this._test.cache.back(code)) {
      this._selected.cache = 'back';
    }

    if (this._test.cache.forward(code)) {
      this._selected.cache = 'forward';
    }
  };

  private _checkCache = (): boolean => {
    return this._action.state === 'EDITING_POLYGON' && this._selected.state;
  };
}
