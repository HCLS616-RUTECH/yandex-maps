import { Injectable, signal, VERSION } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class VersionsStore {
  private readonly _angular = VERSION.full;
  private readonly _yandex = signal<string>('0');

  constructor() {}

  get angular(): string {
    return this._angular;
  }

  get yandex(): string {
    return this._yandex();
  }

  set yandex(version: string) {
    this._yandex.set(version);
  }
}
