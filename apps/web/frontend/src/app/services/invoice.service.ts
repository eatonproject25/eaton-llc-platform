import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

export interface InvoiceLineItem {
  id?: number;
  description: string;
  service_date?: string | null;
  quantity: number;
  unit_price: number;
  amount?: number;
}

export interface Invoice {
  id?: number;
  invoice_no?: string;
  invoice_date: string;
  start_date?: string | null;
  end_date?: string | null;
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Void';
  total_amount?: number;
  customer_id: number;
  job_id?: number | null;
  lines?: InvoiceLineItem[];
  // Additional fields from backend response
  customer?: any;
  job?: any;
}

@Injectable({
  providedIn: 'root'
})
export class InvoiceService {
  private apiUrl = environment.apiBaseUrl + 'invoices/';

  constructor(private http: HttpClient) {}

  // Get all invoices with optional filters
  getInvoices(filters?: {
    customer?: string;
    project?: string;
    status?: string;
    date?: string;
  }): Observable<Invoice[]> {
    let params = new HttpParams();
    if (filters?.customer) params = params.set('customer', filters.customer);
    if (filters?.project) params = params.set('project', filters.project);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.date) params = params.set('date', filters.date);
    
    return this.http.get<Invoice[]>(this.apiUrl, { params });
  }

  // Get single invoice by ID
  getInvoiceById(id: number): Observable<Invoice> {
    return this.http.get<Invoice>(`${this.apiUrl}${id}/`);
  }

  // Create new invoice
  createInvoice(invoice: Invoice): Observable<Invoice> {
    return this.http.post<Invoice>(this.apiUrl, invoice);
  }

  // Update invoice
  updateInvoice(id: number, invoice: Partial<Invoice>): Observable<Invoice> {
    return this.http.patch<Invoice>(`${this.apiUrl}${id}/`, invoice);
  }

  // Delete invoice
  deleteInvoice(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}${id}/`);
  }

  // Update invoice status
  updateInvoiceStatus(id: number, status: Invoice['status']): Observable<Invoice> {
    return this.http.patch<Invoice>(`${this.apiUrl}${id}/`, { status });
  }
}

