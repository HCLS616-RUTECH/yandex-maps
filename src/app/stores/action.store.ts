import { Injectable, signal } from '@angular/core';
import { MActionsTypes } from '../models/maps/actions-types.map';
import { TActionState } from '../models/types/action-state.type';

@Injectable({
  providedIn: 'root',
})
export class ActionStore {
  title = signal<string>('');

  private _state: TActionState = 'EMPTY';

  get state(): TActionState {
    return this._state;
  }

  set state(state: TActionState) {
    state === this._state ? (this._state = 'EMPTY') : (this._state = state);

    this.title.set(MActionsTypes[this._state]);
  }
}
