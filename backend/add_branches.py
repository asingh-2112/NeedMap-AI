#!/usr/bin/env python3
"""
Script to add multiple branches to an organization in the database.
Run this from the backend directory:
  cd backend && source venv/bin/activate && python add_branches.py
"""

import os
import sys
from sqlalchemy.orm import Session

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import get_session_local
from app.models.organization import Organization

def add_branches():
    SessionLocal = get_session_local()
    db = SessionLocal()
    
    try:
        # Get the first active organization (parent org)
        parent_org = db.query(Organization).filter(
            Organization.is_branch == False,
            Organization.is_active == True
        ).first()
        
        if not parent_org:
            print("❌ No parent organization found. Create an organization first.")
            return
        
        print(f"✅ Found parent organization: {parent_org.organization_name} (ID: {parent_org.id})")
        print(f"   User ID: {parent_org.user_id}")
        print(f"   Address: {parent_org.address}")
        
        # Sample branches with realistic coordinates
        branches_data = [
            {
                "name": f"{parent_org.organization_name} - Downtown Branch",
                "location": "28.6139, 77.2090",  # Delhi
                "address": "Downtown Area, New Delhi, India"
            },
            {
                "name": f"{parent_org.organization_name} - North Branch",
                "location": "28.6520, 77.2315",  # North Delhi
                "address": "North Area, New Delhi, India"
            },
            {
                "name": f"{parent_org.organization_name} - South Branch",
                "location": "28.5244, 77.1855",  # South Delhi
                "address": "South Area, New Delhi, India"
            },
            {
                "name": f"{parent_org.organization_name} - East Branch",
                "location": "28.5821, 77.2831",  # East Delhi
                "address": "East Area, New Delhi, India"
            },
            {
                "name": f"{parent_org.organization_name} - West Branch",
                "location": "28.6328, 77.0855",  # West Delhi
                "address": "West Area, New Delhi, India"
            },
        ]
        
        # Check if branches already exist
        existing_branches = db.query(Organization).filter(
            Organization.parent_organization_id == parent_org.id,
            Organization.is_branch == True
        ).count()
        
        if existing_branches > 0:
            print(f"\n⚠️  {existing_branches} branches already exist for this organization.")
            response = input("Do you want to continue adding more branches? (y/n): ")
            if response.lower() != 'y':
                print("Cancelled.")
                return
        
        # Add branches
        added_count = 0
        for branch_data in branches_data:
            new_branch = Organization(
                user_id=parent_org.user_id,
                parent_organization_id=parent_org.id,
                organization_name=branch_data["name"],
                branch_location=branch_data["location"],
                address=branch_data["address"],
                phone=parent_org.phone,
                is_branch=True,
                is_active=True
            )
            db.add(new_branch)
            added_count += 1
            print(f"  ✅ Added: {branch_data['name']}")
            print(f"     Location: {branch_data['location']}")
            print(f"     Address: {branch_data['address']}\n")
        
        db.commit()
        print(f"\n✅ Successfully added {added_count} branches!")
        print(f"   Parent: {parent_org.organization_name}")
        print(f"   Total branches now: {len(parent_org.branches) + added_count}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    add_branches()
