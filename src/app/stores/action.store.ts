import { Injectable, signal } from '@angular/core';
import { TActionState } from '../models/types/action-state.type';

@Injectable({
  providedIn: 'root',
})
export class ActionStore {
  private _state = signal<TActionState>('EMPTY');

  get state(): TActionState {
    return this._state();
  }

  set state(state: TActionState) {
    state === this._state() ? this._state.set('EMPTY') : this._state.set(state);
  }
}
