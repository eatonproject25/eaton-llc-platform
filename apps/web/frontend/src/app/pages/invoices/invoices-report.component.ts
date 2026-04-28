// Minimal, practical comments only

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { InvoiceHeader } from './invoices-report.model';
import { NewInvoiceDialogComponent, NewInvoiceResult } from './new-invoice-dialog/new-invoice-dialog.component';
import { InvoiceService } from 'src/app/services/invoice.service';
import { CustomerService } from 'src/app/services/customer.service';
import { JobService } from 'src/app/services/job.service';
import { catchError, of, forkJoin } from 'rxjs';

// Row type with selection flag for bulk ops
type InvoiceRow = InvoiceHeader & { selected?: boolean };

@Component({
  selector: 'app-invoices-report',
  standalone: true,
  // standalone deps used by this component
  imports: [CommonModule, FormsModule, RouterModule, SharedModule, NewInvoiceDialogComponent],
  templateUrl: './invoices-report.component.html',
  styleUrls: ['./invoices-report.component.scss']
})
export class InvoicesReportComponent implements OnInit, OnDestroy {
  // UI state
  selected: InvoiceRow[] = [];
  showNewModal = false;
  loading = false;
  error: string | null = null;
  private routerSubscription?: Subscription;

  // Customer and job data from API
  customers: Array<{ id: number; name: string }> = [];
  jobs: Array<{ id: number; customerId: number; jobNumber: string; projectName: string; performedOn?: string }> = [];
  allJobs: Array<{ id: number; customerId: number; jobNumber: string; projectName: string; performedOn?: string }> = [];

  // open/close new-invoice modal
  navigateToCreateInvoice() { this.showNewModal = true; }
  onCloseNew() { this.showNewModal = false; }

  // Handle customer change in dialog - reload jobs for selected customer
  onCustomerChangeInDialog(customerId: number | null): void {
    if (customerId) {
      this.loadJobsByCustomer(customerId);
    } else {
      this.jobs = [...this.allJobs];
    }
  }

  // handle dialog save
  onSaveNew(result: NewInvoiceResult): void {
    this.showNewModal = false;
    this.loading = true;
    this.error = null;

    // Create invoice via API with date range
    this.invoiceService.createInvoice({
      customer_id: result.customerId,
      job_id: result.jobId,
      invoice_date: result.startDate, // Use start date as invoice date
      start_date: result.startDate,
      end_date: result.endDate,
      status: 'Draft',
      lines: []
    }).pipe(
      catchError(err => {
        this.error = 'Failed to create invoice. Please try again.';
        this.loading = false;
        console.error('Error creating invoice:', err);
        return of(null);
      })
    ).subscribe(invoice => {
      if (invoice && invoice.id) {
        // First, reload invoices to update the dashboard/list so the new invoice appears
        this.loadInvoices();
        // Then navigate to invoice detail page after a brief delay to ensure data is loaded
        setTimeout(() => {
          this.router.navigate(['/invoice-detail', invoice.id]);
        }, 100);
      } else {
        this.loading = false;
      }
    });
  }

  // filter state
  filters = {
    customer: '',
    project: '',
    status: '' as '' | InvoiceHeader['status'],
    date: '' as string, // exact match
  };

  // backing data
  private all: InvoiceRow[] = [];

  // table data (filtered view)
  invoices: InvoiceRow[] = [];

  constructor(
    private router: Router,
    private invoiceService: InvoiceService,
    private customerService: CustomerService,
    private jobService: JobService
  ) {}

  // init list
  ngOnInit(): void {
    this.loadInvoices();
    this.loadCustomers();
    this.loadJobs();
    
    // Reload invoices when returning to this page
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      // Reload invoices if we're on the invoices-report page (but not coming from it)
      const url = event.urlAfterRedirects || event.url || '';
      if (url === '/invoices-report' || (url.startsWith('/invoices-report') && !url.includes('/invoice-detail'))) {
        // Small delay to ensure page is fully loaded
        setTimeout(() => {
          this.loadInvoices();
        }, 100);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  // Load invoices from API
  private loadInvoices(): void {
    this.loading = true;
    this.error = null;

    // Build filters for API call
    const apiFilters: any = {};
    if (this.filters.customer) apiFilters.customer = this.filters.customer;
    if (this.filters.project) apiFilters.project = this.filters.project;
    if (this.filters.status) apiFilters.status = this.filters.status;
    if (this.filters.date) apiFilters.date = this.filters.date;

    this.invoiceService.getInvoices(Object.keys(apiFilters).length > 0 ? apiFilters : undefined)
      .pipe(
        catchError(err => {
          this.error = 'Failed to load invoices. Please try again.';
          this.loading = false;
          console.error('Error loading invoices:', err);
          return of([]);
        })
      )
      .subscribe(invoices => {
        // Map API response to InvoiceRow format
        this.all = invoices.map(inv => ({
          id: inv.id!,
          invoiceNo: inv.invoice_no || '',
          projectName: inv.job?.project || '',
          customerName: inv.customer?.company_name || inv.customer?.name || '',
          invoiceDate: inv.invoice_date,
          status: inv.status,
          totalAmount: inv.total_amount || 0,
          selected: false
        } as InvoiceRow));
        
        // Sort by ID descending (newest first)
        this.all.sort((a, b) => b.id - a.id);
        
        this.applyFilters();
        this.loading = false;
        
        // Debug log to verify invoices are loaded
        console.log(`Loaded ${this.all.length} invoices`);
      });
  }

  // Load customers from API
  private loadCustomers(): void {
    this.customerService.getCustomers()
      .pipe(catchError(err => {
        console.error('Error loading customers:', err);
        return of([]);
      }))
      .subscribe(customers => {
        this.customers = customers.map(c => ({
          id: c.id,
          name: c.company_name || c.name || ''
        }));
      });
  }

  // Load jobs from API
  private loadJobs(): void {
    this.jobService.getAllJobs()
      .pipe(catchError(err => {
        console.error('Error loading jobs:', err);
        return of([]);
      }))
      .subscribe(jobs => {
        // Store all jobs (jobs are related to customers through invoices)
        this.allJobs = jobs.map(j => ({
          id: j.id,
          customerId: 0, // Jobs don't have direct customer relation - filtered through invoices
          jobNumber: j.job_number || '',
          projectName: j.project || '',
          performedOn: j.job_date || undefined
        }));
        // Initially set jobs to all jobs (will be filtered when customer is selected)
        this.jobs = [...this.allJobs];
      });
  }

  // Load jobs filtered by customer
  loadJobsByCustomer(customerId: number): void {
    if (!customerId) {
      this.jobs = [...this.allJobs];
      return;
    }

    this.jobService.getJobsByCustomer(customerId)
      .pipe(catchError(err => {
        console.error('Error loading jobs by customer:', err);
        return of([]);
      }))
      .subscribe(jobs => {
        // Map jobs filtered by customer
        this.jobs = jobs.map(j => ({
          id: j.id,
          customerId: customerId, // Set to the selected customer
          jobNumber: j.job_number || '',
          projectName: j.project || '',
          performedOn: j.job_date || undefined
        }));
      });
  }

  // ngFor perf
  trackById = (_: number, r: InvoiceRow) => r.id;

  // refresh selection after checkbox changes
  onSelect(): void {
    this.selected = this.invoices.filter(r => !!r.selected);
  }

  // multi-field filter - reload from API or filter locally
  applyFilters(): void {
    // Apply filters to the existing data first (client-side filtering)
    const c = this.filters.customer.toLowerCase();
    const p = this.filters.project.toLowerCase();
    const s = this.filters.status;
    const d = this.filters.date;

    let filtered = this.all;

    if (c || p || s || d) {
      filtered = this.all.filter(r => {
        const mC = c ? r.customerName.toLowerCase().includes(c) : true;
        const mP = p ? r.projectName.toLowerCase().includes(p) : true;
        const mS = s ? r.status === s : true;
        const mD = d ? r.invoiceDate === d : true;
        return mC && mP && mS && mD;
      });
    }

    this.invoices = filtered;
    this.onSelect();
  }

  // nav actions
  open(id: number): void { this.router.navigate(['/invoice-detail', id]); }
  edit(id: number): void { this.router.navigate(['/invoice-detail', id]); }

  // delete single
  delete(id: number): void {
    if (!confirm('Are you sure you want to delete this invoice?')) return;
    
    this.loading = true;
    this.error = null;
    
    this.invoiceService.deleteInvoice(id)
      .pipe(
        catchError(err => {
          this.error = 'Failed to delete invoice. Please try again.';
          this.loading = false;
          console.error('Error deleting invoice:', err);
          return of(null);
        })
      )
      .subscribe(() => {
        // Reload invoices after deletion
        this.loadInvoices();
        this.loading = false;
      });
  }

  // bulk actions (placeholders)
  generateSelected(): void {
    console.log('generate on', this.selected.map(s => s.id));
  }

  printSelected(): void {
    if (!this.selected.length) return;
    console.log('Printing selected invoices:', this.selected.map(s => s.id));
    // TODO: implement print/PDF
  }

  deleteSelected(): void {
    if (!this.selected.length) return;
    if (!confirm(`Are you sure you want to delete ${this.selected.length} selected invoice(s)?`)) return;
    
    this.loading = true;
    this.error = null;
    
    const ids = this.selected.map(s => s.id);
    const deleteObservables = ids.map(id => 
      this.invoiceService.deleteInvoice(id).pipe(
        catchError(err => {
          console.error(`Error deleting invoice ${id}:`, err);
          return of(null);
        })
      )
    );

    // Execute all deletes in parallel using forkJoin
    forkJoin(deleteObservables)
      .pipe(
        catchError(err => {
          this.error = 'Some invoices could not be deleted. Please try again.';
          this.loading = false;
          console.error('Error in bulk delete:', err);
          return of([]);
        })
      )
      .subscribe(() => {
        // Reload invoices after deletion
        this.loadInvoices();
        this.selected = [];
        this.loading = false;
      });
  }

  // inline status update
  updateStatus(invoiceId: number, newStatus: string): void {
    this.loading = true;
    this.error = null;
    
    this.invoiceService.updateInvoiceStatus(invoiceId, newStatus as any)
      .pipe(
        catchError(err => {
          this.error = 'Failed to update invoice status. Please try again.';
          this.loading = false;
          console.error('Error updating invoice status:', err);
          return of(null);
        })
      )
      .subscribe(invoice => {
        if (invoice) {
          // Reload invoices to get updated status
          this.loadInvoices();
        }
        this.loading = false;
      });
  }
}
