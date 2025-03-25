import { Component } from '@angular/core';

@Component({
  selector: 'icon-reload',
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
      <path
        d="M19.933 13.041a8 8 0 1 1 -9.925 -8.788c3.899 -1 7.935 1.007 9.425 4.747"
      />
      <path d="M20 4v5h-5" />
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
export class ReloadIcon {}
