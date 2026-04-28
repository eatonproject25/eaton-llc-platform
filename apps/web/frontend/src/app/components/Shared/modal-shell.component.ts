import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-modal-shell',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="open" class="backdrop" (click)="closeOnBackdrop ? close.emit() : null"></div>
    <div *ngIf="open" class="shell" role="dialog" aria-modal="true">
      <div class="card">
        <div class="head">
          <ng-content select="[modal-title]"></ng-content>
          <button class="btn-x" (click)="close.emit()" aria-label="Close">×</button>
        </div>
        <div class="body">
          <ng-content></ng-content>
        </div>
        <div class="foot">
          <ng-content select="[modal-actions]"></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(2px);z-index:1040}
    .shell{position:fixed;inset:0;display:grid;place-items:center;z-index:1050}
    .card{width:min(680px,92vw);background:#fff;border-radius:12px;box-shadow:0 10px 40px rgba(0,0,0,.2);overflow:hidden}
    .head,.foot{padding:12px 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #eee}
    .foot{border-top:1px solid #eee;border-bottom:0;justify-content:end;gap:8px}
    .body{padding:16px}
    .btn-x{border:0;background:transparent;font-size:1.25rem;line-height:1;cursor:pointer}
  `]
})
export class ModalShellComponent {
  @Input() open = false;
  @Input() closeOnBackdrop = false;
  @Output() close = new EventEmitter<void>();
}
