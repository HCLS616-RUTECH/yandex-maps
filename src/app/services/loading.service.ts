import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private readonly _loading = signal<boolean>(false);

  private readonly _percents = signal<number>(0);

  get loading(): boolean {
    return this._loading();
  }

  setState(state: boolean): void {
    this._loading.set(state);
  }

  toggle(): void {
    this._loading.set(!this._loading());
  }
}
