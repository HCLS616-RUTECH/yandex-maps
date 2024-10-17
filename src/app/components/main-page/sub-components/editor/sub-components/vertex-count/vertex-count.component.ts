import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { VERTICAL_ANIMATION } from '../../../../../../animations/vertical.animation';
import { VertexCountStore } from '../../../../../../stores/vertex-count.store';

@Component({
  selector: 'app-vertex-count',
  standalone: true,
  imports: [NgIf],
  templateUrl: './vertex-count.component.html',
  styleUrl: './vertex-count.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [VERTICAL_ANIMATION],
})
export class VertexCountComponent {
  constructor(private readonly _vertexCount: VertexCountStore) {}

  get count(): number {
    return this._vertexCount.state;
  }
}
