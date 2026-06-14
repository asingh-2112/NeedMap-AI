import uuid
from unittest.mock import patch

import pytest


@pytest.fixture(scope="module")
def auth_with_org(client):
    suffix = uuid.uuid4().hex[:6]
    r = client.post(
        "/organizations/register",
        json={
            "organization_name": f"UploadOrg-{suffix}",
            "owner_name": f"owner_{suffix}",
            "owner_email": f"owner_{suffix}@example.com",
            "owner_password": "Test@12345",
        },
    )
    assert r.status_code == 201, r.text
    body = r.json()
    return {
        "headers": {"Authorization": f"Bearer {body['access_token']}"},
        "org_id": body["organization"]["id"],
    }


def test_upload_ingest_csv_creates_need_and_source(client, auth_with_org):
    extracted = {
        "category": "water_access",
        "urgency": "high",
        "location": "Naini",
        "description": "Families need clean water kits.",
        "skills_required": ["logistics"],
        "affected_count": 40,
        "confidence": 0.81,
        "model_used": "llm:mock",
    }

    with patch("app.api.needs.extract_need_from_text", return_value=extracted):
        r = client.post(
            "/needs/ingest/upload",
            headers=auth_with_org["headers"],
            data={
                "source_type": "csv_upload",
                "organization_id": str(auth_with_org["org_id"]),
                "latitude": "25.4",
                "longitude": "81.8",
                "address": "Naini",
                "create_need": "true",
            },
            files={
                "file": ("needs.csv", b"title,urgency\nWater Kits,high\n", "text/csv"),
            },
        )

    assert r.status_code == 201, r.text
    body = r.json()
    assert body["need_id"] is not None
    assert body["source_id"] is not None
    assert body["category"] == "water_access"


def test_upload_source_endpoint_attaches_document(client, auth_with_org):
    create_need = client.post(
        "/needs",
        headers=auth_with_org["headers"],
        json={
            "title": "Need medical kits",
            "description": "Branch request",
            "category": "health",
            "urgency": "medium",
            "organization_id": auth_with_org["org_id"],
            "latitude": 25.45,
            "longitude": 81.84,
            "address": "Prayagraj",
        },
    )
    assert create_need.status_code == 201, create_need.text
    need_id = create_need.json()["id"]

    r = client.post(
        f"/needs/{need_id}/sources/upload",
        headers=auth_with_org["headers"],
        data={
            "source_type": "document",
            "location": "uploaded-file",
        },
        files={
            "file": ("report.pdf", b"%PDF-1.4 mock", "application/pdf"),
        },
    )

    assert r.status_code == 201, r.text
    source = r.json()
    assert source["need_id"] == need_id
    assert source["source_type"] == "document"
