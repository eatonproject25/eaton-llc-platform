#!/usr/bin/env python
import os
import sys
import django

# Add the project directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_project.settings')
django.setup()

from django.contrib.auth.models import User
from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal
from myapp.models import Customer, Invoice, InvoiceLineItem, Job, Address, Operator, Truck

def create_sample_data():
    print("Creating sample data...")
    
    # Create a user
    user, created = User.objects.get_or_create(
        username='admin',
        defaults={
            'email': 'admin@eaton.com',
            'first_name': 'Admin',
            'last_name': 'User',
            'is_staff': True,
            'is_superuser': True
        }
    )
    if created:
        user.set_password('admin123')
        user.save()
        print('Created admin user (username: admin, password: admin123)')
    
    # Create sample customer
    customer, created = Customer.objects.get_or_create(
        company_name='Rochester Sand & Gravel',
        defaults={
            'company_dba_name': 'Rochester Sand & Gravel',
            'address': '4105 East River Road NE, Rochester MN 55906',
            'city': 'Rochester',
            'phone_number': '(507) 282-1234',
            'email': 'info@rochestersand.com',
            'additional_comments': 'Regular customer for sand and gravel delivery'
        }
    )
    if created:
        print(f'Created customer: {customer.company_name}')
    
    # Create sample invoice (using only existing fields)
    invoice, created = Invoice.objects.get_or_create(
        invoice_no='INV-000001',
        defaults={
            'invoice_date': date.today() - timedelta(days=25),
            'status': 'Sent',
            'company_name': 'M Eaton Trucking LLC',
            'company_address': '15790 320th Ave, Waseca, MN 56093',
            'customer': customer,
            'customer_name': 'Rochester Sand & Gravel',
            'customer_address': '4105 East River Road NE, Rochester MN 55906',
            'tax_rate': Decimal('0.0875'),
            'created_by': user
        }
    )
    if created:
        print(f'Created invoice: {invoice.invoice_no}')
    
    # Create sample line item
    line_item, created = InvoiceLineItem.objects.get_or_create(
        invoice=invoice,
        bol_scale_ticket='7 Jireh 7',
        defaults={
            'date': date.today() - timedelta(days=28),
            'description': '4952467-19 Dodge Center',
            'weight_time': Decimal('10.5'),
            'rate': Decimal('114.00')
        }
    )
    if created:
        print(f'Created line item: {line_item.description}')
    
    # Update invoice totals
    invoice.calculate_totals()
    invoice.save(update_fields=['subtotal', 'tax_amount', 'total'])
    
    print("Sample data created successfully!")
    print(f"Invoice {invoice.invoice_no} total: ${invoice.total}")

if __name__ == '__main__':
    create_sample_data()
