import { NgClass } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { VERTICAL_ANIMATION } from '../../../../../../shared/animations/vertical.animation';

@Component({
  selector: 'app-cache',
  standalone: true,
  imports: [NgClass],
  templateUrl: './cache.component.html',
  styleUrl: './cache.component.scss',
  animations: [VERTICAL_ANIMATION],
})
export class CacheComponent {
  @Input() cache: { length: number; index: number } = { length: 0, index: -1 };

  @Output() onSetCache = new EventEmitter<'back' | 'forward'>();

  setCache(to: 'back' | 'forward'): void {
    this.onSetCache.emit(to);
  }
}
