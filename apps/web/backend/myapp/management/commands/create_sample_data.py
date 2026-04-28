from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal
from myapp.models import (
    Customer, Job, Address, Operator, Truck, Driver, DriverTruckAssignment,
    Invoice, InvoiceLine
)


class Command(BaseCommand):
    help = 'Create sample data for testing'

    def handle(self, *args, **options):
        self.stdout.write('Creating sample data...')
        
        # Create a user if it doesn't exist
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
            self.stdout.write('Created admin user')
        
        # Create sample customers
        customers_data = [
            {
                'company_name': 'Rochester Sand & Gravel',
                'company_dba_name': 'Rochester Sand & Gravel',
                'address': '4105 East River Road NE, Rochester MN 55906',
                'city': 'Rochester',
                'phone_number': '(507) 282-1234',
                'email': 'info@rochestersand.com',
                'additional_comments': 'Regular customer for sand and gravel delivery'
            },
            {
                'company_name': 'Minneapolis Construction Co.',
                'company_dba_name': 'Mpls Construction',
                'address': '1234 Industrial Blvd, Minneapolis MN 55401',
                'city': 'Minneapolis',
                'phone_number': '(612) 555-9876',
                'email': 'orders@mplsconstruction.com',
                'additional_comments': 'Large construction projects'
            },
            {
                'company_name': 'St. Paul Materials',
                'company_dba_name': 'SP Materials',
                'address': '5678 Commerce Drive, St. Paul MN 55102',
                'city': 'St. Paul',
                'phone_number': '(651) 777-5432',
                'email': 'contact@spmaterials.com',
                'additional_comments': 'Bulk material supplier'
            }
        ]
        
        customers = []
        for customer_data in customers_data:
            customer, created = Customer.objects.get_or_create(
                company_name=customer_data['company_name'],
                defaults=customer_data
            )
            customers.append(customer)
            if created:
                self.stdout.write(f'Created customer: {customer.company_name}')
        
        # Create sample addresses
        addresses_data = [
            {
                'street_address': '15790 320th Ave',
                'country': 'USA',
                'state': 'MN',
                'city': 'Waseca',
                'zip_code': '56093',
                'location_name': 'M Eaton Trucking Base',
                'latitude': Decimal('44.0778'),
                'longitude': Decimal('-93.5075'),
                'location_type': 'Loading'
            },
            {
                'street_address': '4105 East River Road NE',
                'country': 'USA',
                'state': 'MN',
                'city': 'Rochester',
                'zip_code': '55906',
                'location_name': 'Rochester Sand & Gravel',
                'latitude': Decimal('44.0233'),
                'longitude': Decimal('-92.4697'),
                'location_type': 'Unloading'
            },
            {
                'street_address': '1234 Industrial Blvd',
                'country': 'USA',
                'state': 'MN',
                'city': 'Minneapolis',
                'zip_code': '55401',
                'location_name': 'Minneapolis Construction Site',
                'latitude': Decimal('44.9778'),
                'longitude': Decimal('-93.2650'),
                'location_type': 'Unloading'
            }
        ]
        
        addresses = []
        for address_data in addresses_data:
            address, created = Address.objects.get_or_create(
                street_address=address_data['street_address'],
                city=address_data['city'],
                defaults=address_data
            )
            addresses.append(address)
            if created:
                self.stdout.write(f'Created address: {address.street_address}')
        
        # Create sample operators and trucks
        operator, created = Operator.objects.get_or_create(
            name='M Eaton Trucking LLC',
            defaults={'operator_type': 'MTO'}
        )
        if created:
            self.stdout.write(f'Created operator: {operator.name}')
        
        trucks_data = [
            {
                'truck_type': 'Dump Truck',
                'carrier': 'M Eaton Trucking LLC',
                'truck_number': 'Dump Truck I',
                'license_plate': 'ABC-123',
                'market': ['Sand', 'Gravel', 'Construction']
            },
            {
                'truck_type': 'Dump Truck',
                'carrier': 'M Eaton Trucking LLC',
                'truck_number': 'Dump Truck II',
                'license_plate': 'DEF-456',
                'market': ['Sand', 'Gravel', 'Construction']
            }
        ]
        
        trucks = []
        for truck_data in trucks_data:
            truck_data['operator'] = operator
            truck, created = Truck.objects.get_or_create(
                truck_number=truck_data['truck_number'],
                defaults=truck_data
            )
            trucks.append(truck)
            if created:
                self.stdout.write(f'Created truck: {truck.truck_number}')
        
        # Create sample jobs
        jobs_data = [
            {
                'project': '4952467-19 Dodge Center',
                'prime_contractor': 'Dodge Center Construction',
                'prime_contractor_project_number': '4952467-19',
                'contractor_invoice': 'INV-001',
                'contractor_invoice_project_number': 'PROJ-001',
                'prevailing_or_not': 'No',
                'job_description': 'Sand and gravel delivery for road construction',
                'job_number': 'JOB-001',
                'material': 'Sand and Gravel',
                'truck_types': ['Dump Truck'],
                'job_date': date.today() - timedelta(days=30),
                'shift_start': timezone.now().time().replace(hour=8, minute=0),
                'loading_address': addresses[0],  # M Eaton base
                'unloading_address': addresses[1],  # Rochester
                'is_backhaul_enabled': False,
                'job_foreman_name': 'John Smith',
                'job_foreman_contact': '(507) 123-4567',
                'additional_notes': 'Standard delivery route'
            },
            {
                'project': 'Minneapolis Highway Project',
                'prime_contractor': 'Minneapolis Construction Co.',
                'prime_contractor_project_number': 'MSP-2024-001',
                'contractor_invoice': 'INV-002',
                'contractor_invoice_project_number': 'PROJ-002',
                'prevailing_or_not': 'Yes',
                'job_description': 'Material delivery for highway construction',
                'job_number': 'JOB-002',
                'material': 'Construction Materials',
                'truck_types': ['Dump Truck'],
                'job_date': date.today() - timedelta(days=15),
                'shift_start': timezone.now().time().replace(hour=7, minute=30),
                'loading_address': addresses[0],  # M Eaton base
                'unloading_address': addresses[2],  # Minneapolis
                'is_backhaul_enabled': False,
                'job_foreman_name': 'Mike Johnson',
                'job_foreman_contact': '(612) 987-6543',
                'additional_notes': 'Highway construction project'
            }
        ]
        
        jobs = []
        for job_data in jobs_data:
            job, created = Job.objects.get_or_create(
                job_number=job_data['job_number'],
                defaults=job_data
            )
            jobs.append(job)
            if created:
                self.stdout.write(f'Created job: {job.job_number}')
        
        # Create sample invoices
        invoices_data = [
            {
                'invoice_date': date.today() - timedelta(days=25),
                'status': 'Sent',
                'customer': customers[0],  # Rochester Sand & Gravel
                'job': jobs[0],
            },
            {
                'invoice_date': date.today() - timedelta(days=10),
                'status': 'Draft',
                'customer': customers[1],  # Minneapolis Construction Co.
                'job': jobs[1],
            },
            {
                'invoice_date': date.today() - timedelta(days=45),
                'status': 'Paid',
                'customer': customers[0],  # Rochester Sand & Gravel
                'job': jobs[0],
            }
        ]
        
        invoices = []
        for idx, invoice_data in enumerate(invoices_data):
            try:
                invoice = Invoice.objects.create(**invoice_data)
                invoices.append(invoice)
                self.stdout.write(f'Created invoice: {invoice.invoice_no}')
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'Could not create invoice {idx+1}: {str(e)}'))
                # If invoice already exists, try to find it
                if len(invoices) < len(invoices_data):
                    # Try to get existing invoice for this customer and job
                    existing = Invoice.objects.filter(
                        customer=invoice_data['customer'],
                        job=invoice_data['job']
                    ).first()
                    if existing:
                        invoices.append(existing)
                        self.stdout.write(f'Using existing invoice: {existing.invoice_no}')
        
        # Create sample invoice lines
        line_items_data = [
            # Invoice 1 line items
            {
                'invoice': invoices[0],
                'service_date': date.today() - timedelta(days=28),
                'description': 'Concrete delivery - 4952467-19 Dodge Center',
                'quantity': Decimal('10.5'),
                'unit_price': Decimal('114.00')
            },
            {
                'invoice': invoices[0],
                'service_date': date.today() - timedelta(days=29),
                'description': 'Gravel hauling - 4952467-19 Dodge Center',
                'quantity': Decimal('6.5'),
                'unit_price': Decimal('114.00')
            },
            # Invoice 2 line items
            {
                'invoice': invoices[1],
                'service_date': date.today() - timedelta(days=13),
                'description': 'Minneapolis Highway Project - Phase 1',
                'quantity': Decimal('8.0'),
                'unit_price': Decimal('125.00')
            },
            {
                'invoice': invoices[1],
                'service_date': date.today() - timedelta(days=12),
                'description': 'Minneapolis Highway Project - Phase 2',
                'quantity': Decimal('12.0'),
                'unit_price': Decimal('125.00')
            },
            # Invoice 3 line items
            {
                'invoice': invoices[2],
                'service_date': date.today() - timedelta(days=47),
                'description': 'Sand delivery - Bulk Delivery',
                'quantity': Decimal('15.0'),
                'unit_price': Decimal('110.00')
            },
            {
                'invoice': invoices[2],
                'service_date': date.today() - timedelta(days=46),
                'description': 'Equipment rental',
                'quantity': Decimal('1.0'),
                'unit_price': Decimal('200.00')
            }
        ]
        
        for line_item_data in line_items_data:
            line_item = InvoiceLine.objects.create(**line_item_data)
            self.stdout.write(f'Created line item: {line_item.description}')
        
        # Recalculate invoice totals (handled by signal, but ensure it's done)
        for invoice in invoices:
            invoice.recalc_totals()
        
        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully created sample data:\n'
                f'- {len(customers)} customers\n'
                f'- {len(addresses)} addresses\n'
                f'- {len(jobs)} jobs\n'
                f'- {len(trucks)} trucks\n'
                f'- {len(invoices)} invoices\n'
                f'- {len(line_items_data)} invoice lines\n'
                f'- 1 admin user (username: admin, password: admin123)'
            )
        )
