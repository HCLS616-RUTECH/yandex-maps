import { AsyncPipe, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';
import { ISelectedParams } from '../../../../models/interfaces/selected-params.interface';
import { ActionStore } from '../../../../stores/action.store';
import { SelectedStore } from '../../../../stores/selected.store';
import { VertexCountStore } from '../../../../stores/vertex-count.store';

@UntilDestroy()
@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [NgIf, AsyncPipe],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss',
})
export class EditorComponent {
  constructor(
    private readonly _action: ActionStore,
    private readonly _selected: SelectedStore,
    private readonly _vertexCount: VertexCountStore
  ) {}

  get action(): string {
    return this._action.title();
  }

  get vertexCount(): number {
    return this._vertexCount.state;
  }

  get selected$(): Observable<ISelectedParams | null> {
    return this._selected.params$.pipe(untilDestroyed(this));
  }
}
