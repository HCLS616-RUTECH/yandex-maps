export class Queue<T> extends Array {
  private _max = 25;

  constructor(...args: any[]) {
    if (args.length === 1 && typeof args[0] === 'number') {
      super();
      this.push(args[0]);
      return;
    }

    super(...args);
  }

  get max(): number {
    return this._max;
  }

  set max(max: number) {
    this._max = max;
  }

  get array(): T[] {
    return Array.from(this);
  }

  add = (value: T): void => {
    if (this.length >= this._max) {
      this.shift();
    }

    this.push(value);
  };

  update = (value: T[]): void => {
    this.length = 0;
    this.push(...value);
  };

  cut = (length: number): void => {
    this.length = length;
  };
}
