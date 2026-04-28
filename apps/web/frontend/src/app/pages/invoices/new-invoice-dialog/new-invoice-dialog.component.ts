// src/app/pages/invoices/new-invoice-dialog/new-invoice-dialog.component.ts
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface NewInvoiceResult {
  customerId: number;
  jobId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (week range)
}

export interface DialogCustomer {
  id: number;
  name: string;
}

export interface DialogJob {
  id: number;
  customerId: number;
  jobNumber: string;
  projectName: string;
  performedOn?: string; // optional (if you want to suggest a date)
}

@Component({
  selector: 'app-new-invoice-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './new-invoice-dialog.component.html',
  styleUrls: ['./new-invoice-dialog.component.scss']
})
export class NewInvoiceDialogComponent {
  @Input({ required: true }) customers: DialogCustomer[] = [];
  @Input({ required: true }) jobs: DialogJob[] = [];

  @Output() cancel = new EventEmitter<void>();
  @Output() save = new EventEmitter<NewInvoiceResult>();
  @Output() customerChange = new EventEmitter<number | null>();

  // UI state
  customerQuery = '';
  jobQuery = '';
  selectedCustomerId: number | null = null;
  selectedJobId: number | null = null;
  startDate = this.today();
  endDate = this.getWeekEndDate(this.today());

  // filter helpers
  filteredCustomers(): DialogCustomer[] {
    const q = this.customerQuery.trim().toLowerCase();
    return !q ? this.customers : this.customers.filter(c => c.name.toLowerCase().includes(q));
  }

  filteredJobs(): DialogJob[] {
    if (this.selectedCustomerId == null) return [];
    const q = this.jobQuery.trim().toLowerCase();
    return this.jobs
      .filter(j => j.customerId === this.selectedCustomerId)
      .filter(j =>
        !q ||
        j.jobNumber.toLowerCase().includes(q) ||
        j.projectName.toLowerCase().includes(q)
      );
  }

  onCustomerChange() {
    // reset job selection + query when customer changes
    this.selectedJobId = null;
    this.jobQuery = '';
    // Emit customer change event so parent can reload jobs for this customer
    this.customerChange.emit(this.selectedCustomerId);
  }

  canSave(): boolean {
    return this.selectedCustomerId != null && this.selectedJobId != null && !!this.startDate && !!this.endDate;
  }

  doSave() {
    if (!this.canSave() || this.selectedCustomerId == null || this.selectedJobId == null) return;
    this.save.emit({ 
      customerId: this.selectedCustomerId, 
      jobId: this.selectedJobId, 
      startDate: this.startDate,
      endDate: this.endDate
    });
  }

  today(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  getWeekEndDate(startDateStr: string): string {
    const startDate = new Date(startDateStr);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6); // Add 6 days to get end of week (7 days total)
    const mm = String(endDate.getMonth() + 1).padStart(2, '0');
    const dd = String(endDate.getDate()).padStart(2, '0');
    return `${endDate.getFullYear()}-${mm}-${dd}`;
  }

  onStartDateChange() {
    // Automatically update end date when start date changes (week range)
    this.endDate = this.getWeekEndDate(this.startDate);
  }
}
