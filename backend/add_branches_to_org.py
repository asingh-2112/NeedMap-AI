#!/usr/bin/env python3
"""
Script to add multiple branches to a specific organization by ID.
Run this from the backend directory:
  cd backend && source venv/bin/activate && python add_branches_to_org.py
"""

import os
import sys
from sqlalchemy.orm import Session

# Add the app directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from app.core.database import get_session_local
from app.models.organization import Organization

def add_branches_to_org(org_id=8):
    SessionLocal = get_session_local()
    db = SessionLocal()
    
    try:
        # Get the organization by ID
        parent_org = db.query(Organization).filter(
            Organization.id == org_id,
            Organization.is_active == True
        ).first()
        
        if not parent_org:
            print(f"❌ Organization with ID {org_id} not found or inactive.")
            return
        
        print(f"✅ Found organization: {parent_org.organization_name} (ID: {parent_org.id})")
        print(f"   User ID: {parent_org.user_id}")
        print(f"   Address: {parent_org.address}")
        print(f"   Current branches: {len(parent_org.branches)}\n")
        
        # Sample branches with realistic coordinates for different cities
        branches_data = [
            {
                "name": f"{parent_org.organization_name} - Branch 1",
                "location": "19.0760, 72.8777",  # Mumbai
                "address": "Mumbai Branch, Maharashtra, India"
            },
            {
                "name": f"{parent_org.organization_name} - Branch 2",
                "location": "28.7041, 77.1025",  # Delhi
                "address": "Delhi Branch, New Delhi, India"
            },
            {
                "name": f"{parent_org.organization_name} - Branch 3",
                "location": "13.0827, 80.2707",  # Chennai
                "address": "Chennai Branch, Tamil Nadu, India"
            },
            {
                "name": f"{parent_org.organization_name} - Branch 4",
                "location": "31.5497, 74.3436",  # Lahore
                "address": "Lahore Branch, Punjab, Pakistan"
            },
            {
                "name": f"{parent_org.organization_name} - Branch 5",
                "location": "23.1815, 79.9864",  # Jabalpur
                "address": "Jabalpur Branch, Madhya Pradesh, India"
            },
            {
                "name": f"{parent_org.organization_name} - Branch 6",
                "location": "18.5204, 73.8567",  # Pune
                "address": "Pune Branch, Maharashtra, India"
            },
        ]
        
        # Check existing branches
        existing_branches = db.query(Organization).filter(
            Organization.parent_organization_id == parent_org.id,
            Organization.is_branch == True
        ).all()
        
        print(f"📍 Existing branches: {len(existing_branches)}")
        for branch in existing_branches:
            print(f"   - {branch.organization_name} ({branch.branch_location})")
        
        # Remove duplicates - only add branches that don't exist
        existing_names = {b.organization_name for b in existing_branches}
        branches_to_add = [b for b in branches_data if b["name"] not in existing_names]
        
        if not branches_to_add:
            print("\n⚠️  All branches already exist.")
            return
        
        print(f"\n📌 Adding {len(branches_to_add)} new branches...\n")
        
        # Add branches
        added_count = 0
        for branch_data in branches_to_add:
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
        print(f"\n✅ Successfully added {added_count} new branches!")
        print(f"   Organization: {parent_org.organization_name}")
        print(f"   Total branches now: {len(existing_branches) + added_count}")
        
    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    import sys
    org_id = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    print(f"Adding branches to organization ID: {org_id}\n")
    add_branches_to_org(org_id)
