#!/usr/bin/env python3
"""
Galvaniy Labs — Comprehensive End-to-End Test
==============================================
Simulates the full user journey from login through report generation.

Flow:
  1. Health check
  2. Login (auth profile sync)
  3. Upload a test manual
  4. Generate report for experiment A-3
  5. Validate the full report structure
  6. List reports and verify persistence
  7. Admin operations (stats, users, settings)

Uses REAL Gemini API for generation but mocks Firebase auth and Firestore
since we may not have service account credentials configured yet.
"""

import os
import sys
import json
import asyncio
import time
from datetime import datetime
from unittest.mock import patch, MagicMock, AsyncMock

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Load environment
from dotenv import load_dotenv
load_dotenv()

from httpx import AsyncClient, ASGITransport
from app.main import create_app
from app.middleware.auth import get_current_user, require_admin, AuthenticatedUser
from app.models.user import UserProfile
from app.models.settings import GlobalSettings, AdminStats
from app.models.manual import ManualPage, ManualMetadata

# ==================== Test Configuration ====================

TEST_USER = AuthenticatedUser(
    uid="e2e-test-user-001",
    email="qsmceoglvn@gmail.com",
    role="admin",  # Admin so we can test all endpoints
    display_name="E2E Test User",
)

SAMPLE_MANUAL_TEXT = """
EXPERIMENT A-3: SIMPLE PENDULUM

OBJECTIVE:
To measure the period of a simple pendulum.

APPARATUS:
Pendulum bob, string, stopwatch.

PROCEDURE:
1. Hang the pendulum with a length of 1 meter.
2. Swing the pendulum and measure the time for 10 oscillations.
3. Calculate the period T.
"""

# ==================== Helpers ====================

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
INFO = "\033[94mℹ\033[0m"
WARN = "\033[93m⚠\033[0m"

def section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def check(label: str, passed: bool, detail: str = ""):
    icon = PASS if passed else FAIL
    suffix = f" — {detail}" if detail else ""
    print(f"  {icon} {label}{suffix}")
    return passed

results = {"passed": 0, "failed": 0}

def assert_check(label: str, condition: bool, detail: str = ""):
    ok = check(label, condition, detail)
    if ok:
        results["passed"] += 1
    else:
        results["failed"] += 1
    return ok


# ==================== Mock Setup ====================

def create_mock_firestore():
    """Create a mock Firestore service that stores data in memory."""
    store = {
        "users": {},
        "reports": {},
        "settings": GlobalSettings(),
        "manual_pages": [],
        "manual_metadata": None,
    }

    mock = MagicMock()

    # User Profile
    async def get_user_profile(uid):
        return store["users"].get(uid)
    mock.get_user_profile = AsyncMock(side_effect=get_user_profile)

    async def create_user_profile(profile):
        store["users"][profile.uid] = profile
    mock.create_user_profile = AsyncMock(side_effect=create_user_profile)

    async def update_last_login(uid):
        if uid in store["users"]:
            store["users"][uid].last_login = datetime.utcnow()
    mock.update_last_login = AsyncMock(side_effect=update_last_login)

    async def update_user_profile(uid, updates):
        if uid in store["users"]:
            for k, v in updates.items():
                setattr(store["users"][uid], k, v)
    mock.update_user_profile = AsyncMock(side_effect=update_user_profile)

    async def get_all_users():
        return list(store["users"].values())
    mock.get_all_users = AsyncMock(side_effect=get_all_users)

    async def increment_report_count(uid):
        if uid in store["users"]:
            store["users"][uid].reports_generated += 1
    mock.increment_report_count = AsyncMock(side_effect=increment_report_count)

    # Settings
    async def get_settings():
        return store["settings"]
    mock.get_settings = AsyncMock(side_effect=get_settings)

    async def update_settings(updates, email=""):
        for k, v in updates.items():
            setattr(store["settings"], k, v)
    mock.update_settings = AsyncMock(side_effect=update_settings)

    # Manual
    async def get_manual_pages():
        return store["manual_pages"]
    mock.get_manual_pages = AsyncMock(side_effect=get_manual_pages)

    async def get_manual_metadata():
        return store["manual_metadata"]
    mock.get_manual_metadata = AsyncMock(side_effect=get_manual_metadata)

    async def upload_manual(pages, filename, admin_email):
        store["manual_pages"] = pages
        store["manual_metadata"] = ManualMetadata(
            name=filename,
            uploaded_by=admin_email,
            page_count=len(pages),
        )
    mock.upload_manual = AsyncMock(side_effect=upload_manual)

    async def clear_manual():
        store["manual_pages"] = []
        store["manual_metadata"] = None
    mock.clear_manual = AsyncMock(side_effect=clear_manual)

    # Reports
    async def save_report(uid, report):
        if uid not in store["reports"]:
            store["reports"][uid] = []
        store["reports"][uid].append(report)
    mock.save_report = AsyncMock(side_effect=save_report)

    async def get_user_reports(uid):
        return store["reports"].get(uid, [])
    mock.get_user_reports = AsyncMock(side_effect=get_user_reports)

    # Stats
    async def get_admin_stats():
        users = list(store["users"].values())
        students = [u for u in users if u.role == "student"]
        return AdminStats(
            total_students=len(students),
            total_reports=sum(u.reports_generated for u in users),
            active_students=len([u for u in students if not u.is_revoked]),
            revoked_students=len([u for u in students if u.is_revoked]),
        )
    mock.get_admin_stats = AsyncMock(side_effect=get_admin_stats)

    return mock, store


# ==================== Main Test ====================

async def run_e2e_test():
    print("\n" + "🧪" * 30)
    print("  GALVANIY LABS — END-TO-END TEST")
    print("  Simulating full user journey: Login → Generate Report A-3")
    print("🧪" * 30)

    # Create app and setup mocks
    app = create_app()
    mock_fs, store = create_mock_firestore()

    # Override auth dependency to return our test user
    app.dependency_overrides[get_current_user] = lambda: TEST_USER
    app.dependency_overrides[require_admin] = lambda: TEST_USER

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:

        # ============================================================
        section("STEP 1: Health Check")
        # ============================================================
        resp = await client.get("/api/health")
        assert_check("Health endpoint responds", resp.status_code == 200)
        health = resp.json()
        assert_check("Status is healthy", health.get("status") == "healthy")
        assert_check("App name correct", "Galvaniy" in health.get("app", ""))

        # ============================================================
        section("STEP 2: User Login & Profile Sync")
        # ============================================================
        with patch("app.routers.auth.firestore_service", mock_fs):
            # POST /api/auth/profile — simulates first login
            resp = await client.post("/api/auth/profile")
            assert_check("Profile sync returns 200", resp.status_code == 200)
            profile = resp.json()
            assert_check("Profile has correct UID", profile.get("uid") == TEST_USER.uid)
            assert_check("Profile has correct email", profile.get("email") == TEST_USER.email)
            assert_check("Profile has admin role", profile.get("role") == "admin")
            print(f"  {INFO} Profile created: {profile.get('email')}")

            # GET /api/auth/me — fetch profile
            resp = await client.get("/api/auth/me")
            assert_check("GET /me returns 200", resp.status_code == 200)
            me = resp.json()
            assert_check("GET /me returns same user", me.get("uid") == TEST_USER.uid)

        # ============================================================
        section("STEP 3: Upload Lab Manual")
        # ============================================================
        # Pre-load manual text into our mock store (simulating upload)
        manual_pages = [
            ManualPage(id="page_1", page_number=1, text=SAMPLE_MANUAL_TEXT),
        ]
        store["manual_pages"] = manual_pages
        store["manual_metadata"] = ManualMetadata(
            name="E2E_Test_Manual.pdf",
            uploaded_by=TEST_USER.email,
            page_count=1,
        )
        assert_check("Manual loaded", len(store["manual_pages"]) == 1, "1 page")
        assert_check("Manual text length", len(SAMPLE_MANUAL_TEXT) > 500, f"{len(SAMPLE_MANUAL_TEXT)} chars")

        # ============================================================
        section("STEP 4: Generate Report for Experiment A-3")
        # ============================================================
        print(f"  {INFO} Calling Gemini API (this may take 30-60 seconds)...")
        start_time = time.time()

        with patch("app.routers.reports.firestore_service", mock_fs):
            resp = await client.post(
                "/api/reports/generate",
                json={"experiment_code": "A-3"},
            )
            elapsed = time.time() - start_time
            print(f"  {INFO} Generation took {elapsed:.1f}s")

            assert_check("Generate returns 200", resp.status_code == 200, f"status={resp.status_code}")

            if resp.status_code != 200:
                print(f"  {FAIL} Response: {resp.text}")
                return

            report_data = resp.json()
            assert_check("Report has ID", bool(report_data.get("id")))
            assert_check("Report has experiment_code", report_data.get("experiment_code") == "A-3")
            assert_check("Report has date", bool(report_data.get("date")))
            assert_check("Report has content", bool(report_data.get("content")))

            # Save the generated report to a file for the user to inspect
            with open("generated_report_A-3.json", "w") as f:
                json.dump(json.loads(report_data.get("content", "{}")), f, indent=2)
            print(f"  {INFO} Generated report saved to backend/generated_report_A-3.json")

        # ============================================================
        section("STEP 5: Validate Report Content (JSON Structure)")
        # ============================================================
        content_str = report_data.get("content", "{}")
        try:
            content = json.loads(content_str)
            assert_check("Content is valid JSON", True)
        except json.JSONDecodeError as e:
            assert_check("Content is valid JSON", False, str(e))
            print(f"  {FAIL} Raw content (first 500 chars): {content_str[:500]}")
            return

        # Required fields
        assert_check("Has 'title'", "title" in content, f"title={content.get('title', 'MISSING')[:60]}")
        assert_check("Has 'objectives'", "objectives" in content and isinstance(content["objectives"], list))
        assert_check("Has 'apparatus'", "apparatus" in content and isinstance(content["apparatus"], list))
        assert_check("Has 'procedure'", "procedure" in content and isinstance(content["procedure"], list))

        # Check objectives are non-empty
        objectives = content.get("objectives", [])
        assert_check("Objectives non-empty", len(objectives) > 0, f"{len(objectives)} objectives")

        # Check apparatus list
        apparatus = content.get("apparatus", [])
        assert_check("Apparatus non-empty", len(apparatus) > 0, f"{len(apparatus)} items")

        # Check procedure
        procedure = content.get("procedure", [])
        assert_check("Procedure non-empty", len(procedure) > 0, f"{len(procedure)} steps")

        # Data section
        tables = content.get("tables", [])
        assert_check("Has 'tables'", isinstance(tables, list) and len(tables) > 0, f"{len(tables)} tables")
        if tables:
            first_table = tables[0]
            assert_check("Table has headers", "headers" in first_table and len(first_table["headers"]) > 0)
            assert_check("Table has rows", "rows" in first_table and len(first_table["rows"]) > 0)
            headers = first_table.get("headers", [])
            rows = first_table.get("rows", [])
            print(f"  {INFO} First table: {len(headers)} columns × {len(rows)} rows")
            print(f"  {INFO} Headers: {headers}")
            if rows:
                print(f"  {INFO} First row: {rows[0]}")

        # Calculation script
        calc_script = content.get("calculationScript", "")
        assert_check("Has 'calculationScript'", bool(calc_script), f"{len(calc_script)} chars")

        # Analysis template
        analysis = content.get("analysisTemplate", "")
        assert_check("Has 'analysisTemplate'", bool(analysis), f"{len(analysis)} chars")

        # Simulation script
        sim_script = content.get("simulationScript", "")
        assert_check("Has 'simulationScript'", bool(sim_script), f"{len(sim_script)} chars")

        # Controls
        controls = content.get("controls", [])
        assert_check("Has 'controls'", isinstance(controls, list), f"{len(controls)} controls")

        # Content relevance checks
        title = content.get("title", "").lower()
        all_text = json.dumps(content).lower()
        assert_check("Title mentions Ohm or resistance", "ohm" in title or "resist" in title or "voltage" in title, f"title='{content.get('title', '')}'")
        assert_check("Content mentions voltage", "voltage" in all_text or "volt" in all_text)
        assert_check("Content mentions current", "current" in all_text or "ampere" in all_text or "ammeter" in all_text)
        assert_check("Content mentions resistor", "resistor" in all_text or "resistance" in all_text or "ohm" in all_text)

        # ============================================================
        section("STEP 6: List Reports & Verify Persistence")
        # ============================================================
        with patch("app.routers.reports.firestore_service", mock_fs):
            resp = await client.get("/api/reports")
            assert_check("List reports returns 200", resp.status_code == 200)
            reports_list = resp.json()
            assert_check("Reports list has 1 entry", len(reports_list) == 1, f"count={len(reports_list)}")
            if reports_list:
                assert_check("Listed report matches generated", reports_list[0]["id"] == report_data["id"])

        # ============================================================
        section("STEP 7: Admin Operations")
        # ============================================================
        with patch("app.routers.admin.firestore_service", mock_fs):
            # Stats
            resp = await client.get("/api/admin/stats")
            assert_check("Admin stats returns 200", resp.status_code == 200)
            stats = resp.json()
            assert_check("Stats has total_reports", "total_reports" in stats)
            print(f"  {INFO} Stats: {json.dumps(stats)}")

            # Settings
            resp = await client.get("/api/admin/settings")
            assert_check("Admin settings returns 200", resp.status_code == 200)

            # Update settings
            resp = await client.put(
                "/api/admin/settings",
                json={"default_daily_limit": 5},
            )
            assert_check("Update settings returns 200", resp.status_code == 200)

            # Verify settings updated
            resp = await client.get("/api/admin/settings")
            settings = resp.json()
            assert_check("Settings updated correctly", settings.get("default_daily_limit") == 5)

            # Manual metadata
            resp = await client.get("/api/admin/manual/metadata")
            assert_check("Manual metadata returns 200", resp.status_code == 200)

        # ============================================================
        section("STEP 8: Rate Limiting Test")
        # ============================================================
        from app.utils.rate_limiter import check_rate_limit, increment_rate_limit, reset_rate_limits

        reset_rate_limits()
        assert_check("Rate limit: first request allowed", check_rate_limit("test-student", 2))
        increment_rate_limit("test-student")
        assert_check("Rate limit: second request allowed", check_rate_limit("test-student", 2))
        increment_rate_limit("test-student")
        assert_check("Rate limit: third request blocked", not check_rate_limit("test-student", 2))
        reset_rate_limits()

    # ============================================================
    section("RESULTS SUMMARY")
    # ============================================================
    total = results["passed"] + results["failed"]
    print(f"\n  Total:  {total} checks")
    print(f"  {PASS} Passed: {results['passed']}")
    print(f"  {FAIL} Failed: {results['failed']}")

    if results["failed"] == 0:
        print(f"\n  🎉 ALL CHECKS PASSED — E2E test successful!")
    else:
        print(f"\n  ⚠️  Some checks failed — review output above.")

    print()
    return results["failed"] == 0


if __name__ == "__main__":
    success = asyncio.run(run_e2e_test())
    sys.exit(0 if success else 1)
