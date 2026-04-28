export interface InvoiceHeader {
  id: number;            // internal id
  invoiceNo: string;     // public INV #
  projectName: string;
  customerName: string;
  invoiceDate: string;   // YYYY-MM-DD
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Void';
  totalAmount: number;   // numeric for currency pipe
}
