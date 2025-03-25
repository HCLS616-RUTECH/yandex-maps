import { Component } from '@angular/core';

@Component({
  selector: 'icon-polygon',
  standalone: true,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M12 5m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M19 8m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M5 11m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M15 19m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M6.5 9.5l3.5 -3" />
      <path d="M14 5.5l3 1.5" />
      <path d="M18.5 10l-2.5 7" />
      <path d="M13.5 17.5l-7 -5" />
    </svg>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class PolygonIcon {}
