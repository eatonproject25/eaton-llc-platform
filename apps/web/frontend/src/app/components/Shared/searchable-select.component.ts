import { Component, ElementRef, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-searchable-select',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchableSelectComponent<T = any> {
  @Input() items: T[] = [];
  @Input() bindValue: keyof T | null = null;          // e.g. 'id'
  @Input() labelFn: (item: T) => string = (i: any) => String(i?.name ?? i);
  @Input() placeholder = 'Select...';
  @Input() maxResults = 8;

  @Input() value: any = null;
  @Output() valueChange = new EventEmitter<any>();

  open = false;
  query = '';
  activeIndex = -1;

  constructor(private host: ElementRef<HTMLElement>) {}

  get selectedLabel(): string {
    if (!this.value) return '';
    if (this.bindValue) {
      const item = this.items.find(i => (i as any)[this.bindValue!] === this.value);
      return item ? this.labelFn(item) : '';
    }
    return this.labelFn(this.value as T);
  }

  get filtered(): T[] {
    const q = this.query.trim().toLowerCase();
    const all = !q ? this.items : this.items.filter(i => this.labelFn(i).toLowerCase().includes(q));
    return all.slice(0, this.maxResults);
  }

  toggle(open?: boolean) {
    this.open = open ?? !this.open;
    if (this.open) {
      this.query = '';
      this.activeIndex = -1;
    }
  }

  pick(item: T) {
    const val = this.bindValue ? (item as any)[this.bindValue] : item;
    this.value = val;
    this.valueChange.emit(val);
    this.open = false;
  }

  // click outside closes
  @HostListener('document:click', ['$event'])
  onDocClick(ev: MouseEvent) {
    if (!this.host.nativeElement.contains(ev.target as Node)) this.open = false;
  }

  // keyboard on the input
  onKeyDown(ev: KeyboardEvent) {
    const list = this.filtered;
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      this.open = true;
      this.activeIndex = (this.activeIndex + 1) % Math.max(list.length, 1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      this.open = true;
      this.activeIndex = (this.activeIndex - 1 + Math.max(list.length, 1)) % Math.max(list.length, 1);
    } else if (ev.key === 'Enter') {
      if (this.open && list.length && this.activeIndex >= 0) {
        ev.preventDefault();
        this.pick(list[this.activeIndex]);
      }
    } else if (ev.key === 'Escape') {
      this.open = false;
    }
  }
}
