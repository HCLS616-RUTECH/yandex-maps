import { AsyncPipe, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { Observable } from 'rxjs';
import { ISelectedParams } from '../../../../models/interfaces/selected-params.interface';
import { SelectedStore } from '../../../../stores/selected.store';
import { ActionComponent } from './sub-components/action/action.component';
import { VertexCountComponent } from './sub-components/vertex-count/vertex-count.component';

@UntilDestroy()
@Component({
  selector: 'app-editor',
  standalone: true,
  imports: [NgIf, AsyncPipe, ActionComponent, VertexCountComponent],
  templateUrl: './editor.component.html',
  styleUrl: './editor.component.scss',
})
export class EditorComponent {
  constructor(private readonly _selected: SelectedStore) {}

  get selected$(): Observable<ISelectedParams | null> {
    return this._selected.params$.pipe(untilDestroyed(this));
  }
}
