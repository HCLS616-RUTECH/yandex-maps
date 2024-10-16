import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class VertexCountStore {
  private _state = signal<number>(0);

  get state(): number {
    return this._state();
  }

  set state(count: number) {
    this._state.set(count);
  }

  clear(): void {
    if (this._state()) {
      this._state.set(0);
    }
  }
}
