import { Component, OnInit, inject, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { InvoiceService, Invoice, InvoiceLineItem as ApiInvoiceLineItem } from 'src/app/services/invoice.service';
import { catchError, of } from 'rxjs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface InvoiceDetail {
  id: number;
  invoiceNo: string;
  invoiceDate: string;
  dueDate: string;
  customerName: string;
  customerAddress: string;
  companyName: string;
  companyAddress: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Void';
}

export interface InvoiceLineItem {
  id: number;
  date: string;
  truck: string;
  bolScaleTicket: string;
  description: string;
  weightTime: number;
  rate: number;
  amount: number;
}

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, SharedModule],
  templateUrl: './invoice-detail.component.html',
  styleUrls: ['./invoice-detail.component.scss']
})
export class InvoiceDetailComponent implements OnInit {
  @ViewChild('invoiceContent', { static: false }) invoiceContent!: ElementRef;
  
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private invoiceService = inject(InvoiceService);

  invoiceId: number | null = null;
  invoice: InvoiceDetail | null = null;
  isEditing = false;
  editingLineItem: InvoiceLineItem | null = null;
  loading = false;
  error: string | null = null;

  // Company info (could be moved to a config or service)
  companyName = 'M Eaton Trucking LLC';
  companyAddress = '15790 320th Ave, Waseca, MN 56093';

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.invoiceId = idParam ? +idParam : null;
    
    if (this.invoiceId) {
      this.loadInvoice(this.invoiceId);
    }
  }

  loadInvoice(id: number): void {
    this.loading = true;
    this.error = null;
    
    this.invoiceService.getInvoiceById(id)
      .pipe(
        catchError(err => {
          this.error = 'Failed to load invoice. Please try again.';
          this.loading = false;
          console.error('Error loading invoice:', err);
          return of(null);
        })
      )
      .subscribe(apiInvoice => {
        if (apiInvoice) {
          this.invoice = this.mapApiInvoiceToDetail(apiInvoice);
        }
        this.loading = false;
      });
  }

  // Map API invoice response to InvoiceDetail format
  private mapApiInvoiceToDetail(apiInvoice: Invoice): InvoiceDetail {
    const customerName = apiInvoice.customer?.company_name || apiInvoice.customer?.name || '';
    const customerAddress = apiInvoice.customer?.address || '';
    
    // Map line items - use InvoiceLine data from database (service_date, quantity, unit_price)
    // Display using InvoiceLineItem format (date, description, weightTime, rate)
    const lineItems: InvoiceLineItem[] = (apiInvoice.lines || []).map((line, idx) => ({
      id: line.id || idx + 1,
      date: line.service_date || apiInvoice.invoice_date || '', // Use service_date from InvoiceLine, fallback to invoice_date
      truck: '', // Not stored in backend model currently
      bolScaleTicket: '', // Not stored in backend model currently
      description: line.description || '',
      weightTime: line.quantity || 0,
      rate: line.unit_price || 0,
      amount: line.amount || (line.quantity || 0) * (line.unit_price || 0)
    }));

    // Calculate due date (typically 30 days from invoice date)
    const dueDate = this.calculateDueDate(apiInvoice.invoice_date);

    return {
      id: apiInvoice.id!,
      invoiceNo: apiInvoice.invoice_no || '',
      invoiceDate: apiInvoice.invoice_date,
      dueDate: dueDate,
      customerName: customerName,
      customerAddress: customerAddress,
      companyName: this.companyName,
      companyAddress: this.companyAddress,
      lineItems: lineItems,
      subtotal: apiInvoice.total_amount || 0,
      tax: 0, // Tax not stored in backend currently
      total: apiInvoice.total_amount || 0,
      status: apiInvoice.status
    };
  }

  // Calculate due date (30 days from invoice date)
  private calculateDueDate(invoiceDate: string): string {
    const date = new Date(invoiceDate);
    date.setDate(date.getDate() + 30);
    return date.toISOString().split('T')[0];
  }

  goBack(): void {
    this.router.navigate(['/invoices-report']);
  }

  toggleEdit(): void {
    this.isEditing = !this.isEditing;
  }

  editLineItem(lineItem: InvoiceLineItem): void {
    this.editingLineItem = { ...lineItem };
  }

  saveLineItem(): void {
    if (!this.editingLineItem || !this.invoice || !this.invoiceId) return;
    
    // Find the corresponding API line item if it exists
    const existingLineIndex = this.invoice.lineItems.findIndex(item => item.id === this.editingLineItem!.id);
    if (existingLineIndex !== -1) {
      // Auto-calculate amount when weight/time or rate changes
      this.editingLineItem.amount = this.editingLineItem.weightTime * this.editingLineItem.rate;
      
      // Update local copy immediately for UI responsiveness
      this.invoice.lineItems[existingLineIndex] = { ...this.editingLineItem };
      this.recalculateTotals();
      
      // Save to backend - need to update the invoice with new line items
      this.saveInvoiceToBackend();
    }
    
    this.editingLineItem = null;
  }

  cancelEditLineItem(): void {
    this.editingLineItem = null;
  }

  deleteLineItem(lineItem: InvoiceLineItem): void {
    if (!this.invoice || !this.invoiceId) return;
    
    if (confirm('Are you sure you want to delete this line item?')) {
      // Update local copy
      this.invoice.lineItems = this.invoice.lineItems.filter(item => item.id !== lineItem.id);
      this.recalculateTotals();
      
      // Save to backend
      this.saveInvoiceToBackend();
    }
  }

  addLineItem(): void {
    if (!this.invoice) return;
    
    const newLineItem: InvoiceLineItem = {
      id: Date.now(), // Temporary ID
      date: new Date().toISOString().split('T')[0],
      truck: '',
      bolScaleTicket: '',
      description: '',
      weightTime: 0,
      rate: 0,
      amount: 0
    };
    
    this.invoice.lineItems.push(newLineItem);
    this.editLineItem(newLineItem);
  }

  // Save invoice with line items to backend
  private saveInvoiceToBackend(): void {
    if (!this.invoice || !this.invoiceId) return;
    
    this.loading = true;
    this.error = null;
    
    // Map line items back to API format (InvoiceLine format)
    // Backend will handle creating new lines for items without valid database IDs
    const apiLines: ApiInvoiceLineItem[] = this.invoice.lineItems.map(item => ({
      id: item.id, // Backend will check if ID exists in database
      description: item.description,
      service_date: item.date || null, // Map date back to service_date for InvoiceLine
      quantity: item.weightTime,
      unit_price: item.rate,
      amount: item.amount
    }));

    // Update invoice with new line items
    this.invoiceService.updateInvoice(this.invoiceId, {
      lines: apiLines,
      total_amount: this.invoice.total
    } as any)
      .pipe(
        catchError(err => {
          this.error = 'Failed to save invoice changes. Please try again.';
          this.loading = false;
          console.error('Error saving invoice:', err);
          return of(null);
        })
      )
      .subscribe(invoice => {
        if (invoice) {
          // Reload to get the latest data
          this.loadInvoice(this.invoiceId!);
        }
        this.loading = false;
      });
  }

  private recalculateTotals(): void {
    if (!this.invoice) return;
    
    this.invoice.subtotal = this.invoice.lineItems.reduce((sum, item) => sum + item.amount, 0);
    this.invoice.total = this.invoice.subtotal + this.invoice.tax;
  }

  exportPDF(): void {
    if (!this.invoice || !this.invoiceContent) return;
    
    // Hide buttons and actions for PDF export
    const buttons = this.invoiceContent.nativeElement.querySelectorAll('.btn, .d-flex.gap-2');
    buttons.forEach((btn: HTMLElement) => {
      btn.style.display = 'none';
    });

    html2canvas(this.invoiceContent.nativeElement, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    }).then(canvas => {
      // Restore buttons
      buttons.forEach((btn: HTMLElement) => {
        btn.style.display = '';
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`Invoice-${this.invoice!.invoiceNo}.pdf`);
    }).catch(error => {
      console.error('Error generating PDF:', error);
      // Restore buttons in case of error
      buttons.forEach((btn: HTMLElement) => {
        btn.style.display = '';
      });
    });
  }

  exportCSV(): void {
    if (!this.invoice) return;
    
    const csvContent = this.generateCSVContent();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Invoice-${this.invoice.invoiceNo}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  private generateCSVContent(): string {
    if (!this.invoice) return '';
    
    const headers = ['Invoice No', 'Date', 'Due Date', 'Customer', 'Status', 'Date', 'Truck', 'BOL/Scale Ticket', 'Description', 'Weight/Time', 'Rate', 'Amount'];
    const rows: string[] = [];
    
    // Add invoice header row
    rows.push([
      this.invoice.invoiceNo,
      this.invoice.invoiceDate,
      this.invoice.dueDate,
      this.invoice.customerName,
      this.invoice.status,
      '', '', '', '', '', '', ''
    ].join(','));
    
    // Add line items
    this.invoice.lineItems.forEach(item => {
      rows.push([
        '', '', '', '', '',
        item.date,
        item.truck,
        item.bolScaleTicket,
        item.description,
        item.weightTime.toString(),
        item.rate.toString(),
        item.amount.toString()
      ].join(','));
    });
    
    // Add totals row
    rows.push([
      '', '', '', '', '', '', '', '', 'Total', '', '', this.invoice.total.toString()
    ].join(','));
    
    return [headers.join(','), ...rows].join('\n');
  }

  saveInvoice(): void {
    if (!this.invoice || !this.invoiceId) return;
    
    this.loading = true;
    this.error = null;
    
    // Map line items back to API format (InvoiceLine format)
    // Backend will handle creating new lines for items without valid database IDs
    const apiLines: ApiInvoiceLineItem[] = this.invoice.lineItems.map(item => ({
      id: item.id, // Backend will check if ID exists in database
      description: item.description,
      service_date: item.date || null, // Map date back to service_date for InvoiceLine
      quantity: item.weightTime,
      unit_price: item.rate,
      amount: item.amount
    }));

    // Update invoice
    this.invoiceService.updateInvoice(this.invoiceId, {
      invoice_date: this.invoice.invoiceDate,
      status: this.invoice.status,
      lines: apiLines,
      total_amount: this.invoice.total
    } as any)
      .pipe(
        catchError(err => {
          this.error = 'Failed to save invoice. Please try again.';
          this.loading = false;
          console.error('Error saving invoice:', err);
          return of(null);
        })
      )
      .subscribe(invoice => {
        if (invoice) {
          // Reload to get the latest data
          this.loadInvoice(this.invoiceId!);
          this.isEditing = false;
        }
        this.loading = false;
      });
  }

  trackByLineItemId(index: number, item: InvoiceLineItem): number {
    return item.id;
  }
}
