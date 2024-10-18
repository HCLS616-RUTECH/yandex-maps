import { NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { VERTICAL_ANIMATION } from '../../../../../../animations/vertical.animation';

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
  @Input() count: number = 0;
}
