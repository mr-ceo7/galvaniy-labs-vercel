"""Galvaniy Labs Backend — Firestore Service.

Handles all Firestore CRUD operations for users, settings, manual, and reports.
"""

import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from google.cloud.firestore_v1 import SERVER_TIMESTAMP

from app.models.user import UserProfile
from app.models.settings import GlobalSettings, AdminStats
from app.models.manual import ManualPage, ManualMetadata
from app.models.report import Report

logger = logging.getLogger(__name__)


class FirestoreService:
    """Manages Firestore database operations."""

    def __init__(self, db=None):
        """Initialize with a Firestore client.
        
        Args:
            db: Firestore client. If None, will be lazily initialized.
        """
        self._db = db

    @property
    def db(self):
        """Lazy-load Firestore client."""
        if self._db is None:
            from app.dependencies import get_firestore_client
            self._db = get_firestore_client()
        return self._db

    # ==================== SETTINGS ====================

    async def get_settings(self) -> GlobalSettings:
        """Get global settings from Firestore."""
        try:
            doc_ref = self.db.collection("settings").document("global")
            doc = doc_ref.get()

            if doc.exists:
                data = doc.to_dict()
                return GlobalSettings(
                    default_daily_limit=data.get("defaultDailyLimit", 3),
                    custom_instructions=data.get("customInstructions", ""),
                    api_provider=data.get("apiProvider", "gemini"),
                    custom_api_url=data.get("customApiUrl", ""),
                    enable_parallel_generation=data.get("enableParallelGeneration", True),
                    last_updated=str(data["lastUpdated"].isoformat()) if data.get("lastUpdated") else None,
                    updated_by=data.get("updatedBy", ""),
                )

            return GlobalSettings()

        except Exception as e:
            logger.error(f"Error getting settings: {e}")
            return GlobalSettings()

    async def update_settings(self, settings: Dict[str, Any], admin_email: str) -> None:
        """Update global settings."""
        try:
            doc_ref = self.db.collection("settings").document("global")

            # Map Python field names to Firestore field names
            firestore_data = {}
            field_mapping = {
                "default_daily_limit": "defaultDailyLimit",
                "custom_instructions": "customInstructions",
                "api_provider": "apiProvider",
                "custom_api_url": "customApiUrl",
                "enable_parallel_generation": "enableParallelGeneration",
            }

            for py_key, fs_key in field_mapping.items():
                if py_key in settings and settings[py_key] is not None:
                    firestore_data[fs_key] = settings[py_key]

            firestore_data["lastUpdated"] = SERVER_TIMESTAMP
            firestore_data["updatedBy"] = admin_email

            doc_ref.set(firestore_data, merge=True)

        except Exception as e:
            logger.error(f"Error updating settings: {e}")
            raise

    # ==================== MANUAL ====================

    async def get_manual_metadata(self) -> Optional[ManualMetadata]:
        """Get manual metadata."""
        try:
            doc_ref = self.db.collection("manual").document("metadata")
            doc = doc_ref.get()

            if doc.exists:
                data = doc.to_dict()
                return ManualMetadata(
                    name=data.get("name", ""),
                    uploaded_at=str(data["uploadedAt"].isoformat()) if data.get("uploadedAt") else None,
                    uploaded_by=data.get("uploadedBy", ""),
                    version=data.get("version", 1),
                    page_count=data.get("pageCount", 0),
                )

            return None

        except Exception as e:
            logger.error(f"Error getting manual metadata: {e}")
            return None

    async def get_manual_pages(self) -> List[ManualPage]:
        """Get all manual pages from subcollection."""
        try:
            pages_ref = self.db.collection("manual").document("metadata").collection("pages")
            docs = pages_ref.get()

            pages = []
            for doc in docs:
                data = doc.to_dict()
                pages.append(ManualPage(
                    id=data.get("id", doc.id),
                    page_number=data.get("pageNumber", 0),
                    text=data.get("text", ""),
                    image=data.get("image"),
                ))

            return sorted(pages, key=lambda p: p.page_number)

        except Exception as e:
            logger.error(f"Error getting manual pages: {e}")
            return []

    async def upload_manual(
        self, pages: List[ManualPage], file_name: str, admin_email: str
    ) -> None:
        """Upload manual (metadata + pages)."""
        try:
            # Get current version
            current_meta = await self.get_manual_metadata()
            new_version = current_meta.version + 1 if current_meta else 1

            # Upload metadata
            meta_ref = self.db.collection("manual").document("metadata")
            meta_ref.set({
                "name": file_name,
                "uploadedAt": SERVER_TIMESTAMP,
                "uploadedBy": admin_email,
                "version": new_version,
                "pageCount": len(pages),
            })

            # Upload pages in batches (Firestore batch limit is 500)
            pages_ref = self.db.collection("manual").document("metadata").collection("pages")
            batch_size = 500

            for i in range(0, len(pages), batch_size):
                batch = self.db.batch()
                batch_pages = pages[i : i + batch_size]

                for page in batch_pages:
                    page_doc_ref = pages_ref.document(f"page_{page.page_number}")
                    page_data = {
                        "id": page.id,
                        "pageNumber": page.page_number,
                        "text": page.text,
                    }
                    if page.image:
                        page_data["image"] = page.image
                    batch.set(page_doc_ref, page_data)

                batch.commit()

        except Exception as e:
            logger.error(f"Error uploading manual: {e}")
            raise

    async def clear_manual(self) -> None:
        """Delete manual metadata and all pages."""
        try:
            # Delete all pages
            pages_ref = self.db.collection("manual").document("metadata").collection("pages")
            docs = pages_ref.get()

            batch_size = 500
            doc_list = list(docs)

            for i in range(0, len(doc_list), batch_size):
                batch = self.db.batch()
                for doc in doc_list[i : i + batch_size]:
                    batch.delete(doc.reference)
                batch.commit()

            # Delete metadata
            meta_ref = self.db.collection("manual").document("metadata")
            meta_ref.delete()

        except Exception as e:
            logger.error(f"Error clearing manual: {e}")
            raise

    # ==================== USER PROFILES ====================

    async def get_user_profile(self, uid: str) -> Optional[UserProfile]:
        """Get a user profile by UID."""
        try:
            doc_ref = self.db.collection("users").document(uid)
            doc = doc_ref.get()

            if doc.exists:
                data = doc.to_dict()
                return UserProfile(
                    uid=data.get("uid", uid),
                    email=data.get("email", ""),
                    role=data.get("role", "student"),
                    display_name=data.get("displayName"),
                    photo_url=data.get("photoURL"),
                    custom_limit=data.get("customLimit"),
                    is_revoked=data.get("isRevoked", False),
                    reports_generated=data.get("reportsGenerated", 0),
                    created_at=data["createdAt"].replace(tzinfo=None) if data.get("createdAt") else datetime.utcnow(),
                    last_login=data["lastLogin"].replace(tzinfo=None) if data.get("lastLogin") else datetime.utcnow(),
                )

            return None

        except Exception as e:
            logger.error(f"Error getting user profile: {e}")
            return None

    async def create_user_profile(self, profile: UserProfile) -> None:
        """Create or replace a user profile."""
        try:
            doc_ref = self.db.collection("users").document(profile.uid)

            data = {
                "uid": profile.uid,
                "email": profile.email,
                "role": profile.role,
                "isRevoked": profile.is_revoked,
                "reportsGenerated": profile.reports_generated,
                "createdAt": SERVER_TIMESTAMP,
                "lastLogin": SERVER_TIMESTAMP,
            }

            if profile.display_name is not None:
                data["displayName"] = profile.display_name
            if profile.photo_url is not None:
                data["photoURL"] = profile.photo_url
            if profile.custom_limit is not None:
                data["customLimit"] = profile.custom_limit

            doc_ref.set(data)

        except Exception as e:
            logger.error(f"Error creating user profile: {e}")
            raise

    async def update_user_profile(self, uid: str, updates: Dict[str, Any]) -> None:
        """Update specific fields on a user profile."""
        try:
            doc_ref = self.db.collection("users").document(uid)

            # Map Python field names to Firestore field names
            field_mapping = {
                "custom_limit": "customLimit",
                "is_revoked": "isRevoked",
                "reports_generated": "reportsGenerated",
                "role": "role",
                "display_name": "displayName",
                "photo_url": "photoURL",
            }

            firestore_updates = {}
            for py_key, fs_key in field_mapping.items():
                if py_key in updates and updates[py_key] is not None:
                    firestore_updates[fs_key] = updates[py_key]

            if firestore_updates:
                doc_ref.update(firestore_updates)

        except Exception as e:
            logger.error(f"Error updating user profile: {e}")
            raise

    async def get_all_users(self) -> List[UserProfile]:
        """Get all user profiles (for admin panel)."""
        try:
            users_ref = self.db.collection("users")
            docs = users_ref.get()

            users = []
            for doc in docs:
                data = doc.to_dict()
                users.append(UserProfile(
                    uid=data.get("uid", doc.id),
                    email=data.get("email", ""),
                    role=data.get("role", "student"),
                    display_name=data.get("displayName"),
                    photo_url=data.get("photoURL"),
                    custom_limit=data.get("customLimit"),
                    is_revoked=data.get("isRevoked", False),
                    reports_generated=data.get("reportsGenerated", 0),
                    created_at=data["createdAt"].replace(tzinfo=None) if data.get("createdAt") else datetime.utcnow(),
                    last_login=data["lastLogin"].replace(tzinfo=None) if data.get("lastLogin") else datetime.utcnow(),
                ))

            return users

        except Exception as e:
            logger.error(f"Error getting all users: {e}")
            return []

    async def toggle_user_revoke(self, uid: str, is_revoked: bool) -> None:
        """Revoke or unrevoke a user."""
        await self.update_user_profile(uid, {"is_revoked": is_revoked})

    async def increment_report_count(self, uid: str) -> None:
        """Increment the report count for a user."""
        try:
            profile = await self.get_user_profile(uid)
            if profile:
                await self.update_user_profile(uid, {
                    "reports_generated": profile.reports_generated + 1,
                })
        except Exception as e:
            logger.error(f"Error incrementing report count: {e}")
            raise

    async def update_last_login(self, uid: str) -> None:
        """Update the last login timestamp."""
        try:
            doc_ref = self.db.collection("users").document(uid)
            doc_ref.update({"lastLogin": SERVER_TIMESTAMP})
        except Exception as e:
            logger.error(f"Error updating last login: {e}")

    # ==================== REPORTS ====================

    async def save_report(self, user_uid: str, report: Report) -> None:
        """Save a generated report to Firestore."""
        try:
            doc_ref = self.db.collection("reports").document(report.id)
            doc_ref.set({
                "id": report.id,
                "experimentCode": report.experiment_code,
                "date": report.date,
                "content": report.content,
                "userUid": user_uid,
                "createdAt": SERVER_TIMESTAMP,
            })
        except Exception as e:
            logger.error(f"Error saving report: {e}")
            raise

    async def get_user_reports(self, user_uid: str) -> List[Report]:
        """Get all reports for a user."""
        try:
            reports_ref = self.db.collection("reports")
            query = reports_ref.where("userUid", "==", user_uid).order_by(
                "createdAt", direction="DESCENDING"
            )
            docs = query.get()

            reports = []
            for doc in docs:
                data = doc.to_dict()
                reports.append(Report(
                    id=data.get("id", doc.id),
                    experiment_code=data.get("experimentCode", ""),
                    date=data.get("date", ""),
                    content=data.get("content", ""),
                    user_uid=data.get("userUid", ""),
                ))

            return reports

        except Exception as e:
            logger.error(f"Error getting user reports: {e}")
            return []

    # ==================== LAB SESSIONS ====================

    async def save_lab_session(self, user_uid: str, session_data: Dict[str, Any]) -> None:
        """Save a Virtual Lab experiment session."""
        try:
            session_id = f"{user_uid}_{int(datetime.utcnow().timestamp() * 1000)}"
            doc_ref = self.db.collection("lab_sessions").document(session_id)
            session_data["createdAt"] = SERVER_TIMESTAMP
            doc_ref.set(session_data)
            logger.info(f"[Firestore] Lab session saved: {session_id}")
        except Exception as e:
            logger.error(f"Error saving lab session: {e}")
            raise

    # ==================== ADMIN STATS ====================

    async def get_admin_stats(self) -> AdminStats:
        """Get admin dashboard statistics."""
        try:
            users = await self.get_all_users()
            students = [u for u in users if u.role == "student"]

            return AdminStats(
                total_students=len(students),
                total_reports=sum(u.reports_generated for u in students),
                active_students=len([u for u in students if not u.is_revoked]),
                revoked_students=len([u for u in students if u.is_revoked]),
            )

        except Exception as e:
            logger.error(f"Error getting admin stats: {e}")
            return AdminStats()


# Module-level singleton (lazily initialized)
firestore_service = FirestoreService()
