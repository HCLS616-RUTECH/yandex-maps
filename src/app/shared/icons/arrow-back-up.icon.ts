import { Component } from '@angular/core';

@Component({
  selector: 'icon-arrow-back-up',
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
      <path d="M9 14l-4 -4l4 -4" />
      <path d="M5 10h11a4 4 0 1 1 0 8h-1" />
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
export class ArrowBackUpIcon {}
