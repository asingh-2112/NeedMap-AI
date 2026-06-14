#!/usr/bin/env python3
"""Create all NeedMap AI secrets in Google Secret Manager.
Run once after enabling secretmanager.googleapis.com.

Put this file in backend/ and run: python3 create_all_secrets.py
"""
import os, sys

# Find service account
for p in [
    "service-account.json",
    os.path.join(os.path.dirname(__file__), "service-account.json"),
]:
    if os.path.isfile(p):
        sa_path = p
        break
else:
    print("❌ service-account.json not found. Run from backend/")
    sys.exit(1)

from google.cloud import secretmanager
import google.auth

creds, project = google.auth.load_credentials_from_file(sa_path)
print(f"✅ {creds.service_account_email} → {project}")

client = secretmanager.SecretManagerServiceClient(credentials=creds)
parent = f"projects/{project}"

SECRETS = {
    "needmap-db-url": (
        "postgresql://needmap_admin:NeedMapGCPSQL2026!"
        "@34.44.95.197:5432/needmap"
    ),
    "needmap-jwt-secret": os.getenv(
        "NEEDMAP_JWT_SECRET",
        # Generate a random 64-char secret if not provided
        os.urandom(32).hex(),
    ),
    # Optional — only needed if using AI Studio fallback
    "needmap-gemini-api-key": os.getenv("NEEDMAP_GEMINI_KEY", ""),
}

for secret_id, payload in SECRETS.items():
    if not payload:
        print(f"⏭  {secret_id}: empty payload — skipping")
        continue
    secret_path = f"{parent}/secrets/{secret_id}"
    try:
        client.get_secret(request={"name": secret_path})
        print(f"⏭  {secret_id}: exists")
    except Exception:
        client.create_secret(
            request={
                "parent": parent,
                "secret_id": secret_id,
                "secret": {"replication": {"automatic": {}}},
            }
        )
        print(f"✅ {secret_id}: created")

    client.add_secret_version(
        request={
            "parent": secret_path,
            "payload": {"data": payload.encode("UTF-8")},
        }
    )
    print(f"   → payload: {len(payload)} chars")

print("\n✅ All secrets ready. .env needs only APP_NAME, APP_VERSION, LLM_MODEL.")
print("   Everything sensitive lives in Secret Manager.")