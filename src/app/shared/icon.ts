import { Component, input } from '@angular/core';
const paths: Record<string, string> = {
  grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  arrows: 'M7 3v16m-4-4 4 4 4-4 M17 21V5m-4 4 4-4 4 4',
  queue: 'M4 5h16v4H4z M4 15h16v4H4z M8 9v6m8-6v6',
  book: 'M4 3h12a4 4 0 0 1 4 4v14H8a4 4 0 0 1-4-4V3z M4 17a4 4 0 0 1 4-4h12',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  plus: 'M12 5v14M5 12h14',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M5 7a8 8 0 0 1 13-2l2 2 M19 17a8 8 0 0 1-13 2l-2-2',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  down: 'M12 4v16m-6-6 6 6 6-6',
  up: 'M12 20V4m-6 6 6-6 6 6',
  shield: 'm12 3 8 3v6c0 4-5 8-8 9-3-1-8-5-8-9V6l8-3z m-4 9 3 3 5-6',
  clock: 'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  copy: 'M9 9h11v12H9z M15 9V3H3v12h6',
  logout: 'M9 4H4v16h5m5-12 4 4-4 4M8 12h10',
  chevron: 'm6 9 6 6 6-6',
  wallet: 'M20 7H4V4h14v3 M4 7h17v14H4z M21 12h-6v5h6',
  bell: 'M6 9a6 6 0 0 1 12 0v6l2 3H4l2-3V9m4 12h4',
  search: 'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  external: 'M14 3h7v7m0-7-11 11 M10 3H3v18h18v-7',
  undo: 'M8 4 3 9l5 5 M3 9h12a6 6 0 0 1 0 12h-3',
  info: 'M12 11v6m0-10v1 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  database: 'M3 6c0-5 18-5 18 0s-18 5-18 0z M3 6v12c0 5 18 5 18 0V6 M3 12c0 5 18 5 18 0',
  cloud: 'M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13-1 6 6 0 0 1 0 11H6z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  key: 'M14 7a5 5 0 1 1-4 8L3 22l-2-2 7-7a5 5 0 0 1 6-6z',
};
@Component({
  selector: 'app-icon',
  template:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path [attr.d]="path()" /></svg>',
  styles:
    ':host{display:inline-flex;width:20px;height:20px;flex-shrink:0}svg{width:100%;height:100%}',
})
export class Icon {
  readonly name = input('grid');
  path(): string {
    return paths[this.name()] ?? paths['info'];
  }
}
