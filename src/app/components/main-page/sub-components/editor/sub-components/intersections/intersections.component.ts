import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-intersections',
  standalone: true,
  imports: [],
  templateUrl: './intersections.component.html',
  styleUrl: './intersections.component.scss',
})
export class IntersectionsComponent {
  @Output() onClick = new EventEmitter();
}
