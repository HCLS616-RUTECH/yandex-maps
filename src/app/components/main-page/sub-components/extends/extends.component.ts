import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-extends',
  standalone: true,
  imports: [],
  templateUrl: './extends.component.html',
  styleUrl: './extends.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExtendsComponent {}
