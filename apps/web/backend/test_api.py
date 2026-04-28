#!/usr/bin/env python
import os
import sys
import django

# Add the project directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend_project.settings')
django.setup()

import requests

def test_api():
    print("Testing Invoice API...")
    
    # Test the customers endpoint first
    try:
        response = requests.get('http://localhost:8000/api/customers/')
        print(f"Customers API Status: {response.status_code}")
        if response.status_code == 200:
            customers = response.json()
            print(f"Found {len(customers)} customers")
            for customer in customers[:3]:  # Show first 3
                print(f"  - {customer.get('company_name', 'Unknown')}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error testing customers API: {e}")
    
    print("\n" + "="*50 + "\n")
    
    # Test invoice statistics
    try:
        response = requests.get('http://localhost:8000/api/invoices/statistics/')
        print(f"Invoice Statistics API Status: {response.status_code}")
        if response.status_code == 200:
            stats = response.json()
            print("Invoice Statistics:")
            for key, value in stats.items():
                print(f"  {key}: {value}")
        else:
            print(f"Error: {response.text}")
    except Exception as e:
        print(f"Error testing statistics API: {e}")

if __name__ == '__main__':
    test_api()
