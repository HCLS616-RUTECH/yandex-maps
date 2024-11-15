import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  combineLatest,
  map,
  Observable,
  switchMap,
} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class VertexesStore {
  private readonly _state$ = new BehaviorSubject<Array<Observable<number>>>([]);

  get state$(): Observable<number> {
    return this._state$.asObservable().pipe(
      switchMap((observables$) => {
        return combineLatest(observables$).pipe(
          map((counts) => {
            return counts.find((count) => !!count) ?? 0;
          })
        );
      })
    );
  }

  set state(vertexes$: Observable<number>) {
    this._state$.next([...this._state$.value, vertexes$]);
  }
}
