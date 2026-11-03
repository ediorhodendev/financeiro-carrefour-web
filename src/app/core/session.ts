import { Injectable, computed, signal } from '@angular/core';
@Injectable({ providedIn: 'root' })
export class Session {
  readonly token = signal('');
  readonly expiresAt = signal(0);
  readonly subject = signal('');
  readonly connected = computed(() => !!this.token());
  set(token: string, fallbackSeconds = 3600): void {
    const value = token.trim().replace(/^Bearer\s+/i, '');
    if (value.length > 16000) throw new Error('Token inválido.');
    let claims: { sub?: string; exp?: number };
    try {
      const part = value.split('.')[1];
      claims = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    } catch {
      throw new Error('Cole um JWT Bearer válido.');
    }
    const expiry = claims.exp ? claims.exp * 1000 : Date.now() + fallbackSeconds * 1000;
    if (!claims.sub || expiry <= Date.now())
      throw new Error('O token expirou ou não possui identificação.');
    this.subject.set(claims.sub);
    this.expiresAt.set(expiry);
    this.token.set(value);
  }
  clear(): void {
    this.token.set('');
    this.subject.set('');
    this.expiresAt.set(0);
  }
}
