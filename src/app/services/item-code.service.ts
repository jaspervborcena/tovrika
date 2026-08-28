import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ItemCodeService {
  private sequence = 0;
  private lastBase = -1;

  generateItemCode(): string {
    const base = Date.now() % 1000000;
    if (base === this.lastBase) {
      this.sequence = (this.sequence + 1) % 1000000;
    } else {
      this.sequence = 0;
      this.lastBase = base;
    }

    return String((base + this.sequence) % 1000000).padStart(6, '0');
  }
}
