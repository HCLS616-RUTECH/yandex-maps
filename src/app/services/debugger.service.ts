import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class DebuggerService {
  stack: any[] = [];

  add(value: any): void {
    this.stack.push(value);
  }

  view(): void {
    console.log(this.stack);
    this.stack = [];
  }
}
