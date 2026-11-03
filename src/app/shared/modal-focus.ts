import {
  AfterViewInit,
  Directive,
  ElementRef,
  HostListener,
  OnDestroy,
  inject,
} from '@angular/core';
/** Traps keyboard focus in the open dialog and returns it to its trigger. */
@Directive({ selector: '[appModalFocus]' })
export class ModalFocus implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly previous = document.activeElement;
  private items(): HTMLElement[] {
    return [
      ...this.host.nativeElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex="0"]',
      ),
    ].filter((el) => el.offsetParent !== null);
  }
  ngAfterViewInit(): void {
    queueMicrotask(() => this.items()[0]?.focus());
  }
  @HostListener('keydown', ['$event']) onKey(event: KeyboardEvent): void {
    if (event.key !== 'Tab') return;
    const items = this.items(),
      first = items[0],
      last = items.at(-1);
    if (!first) {
      event.preventDefault();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  ngOnDestroy(): void {
    if (this.previous instanceof HTMLElement && document.contains(this.previous))
      this.previous.focus();
  }
}
