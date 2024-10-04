import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private readonly _state = signal<boolean>(false);

  private readonly _percents = signal<number>(0);

  get state(): boolean {
    return this._state();
  }

  set state(state: boolean) {
    this._state.set(state);
  }

  toggle(): void {
    this._state.set(!this._state());
  }
}
