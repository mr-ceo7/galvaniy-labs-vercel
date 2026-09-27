"""Galvaniy Labs Backend — SQLite Storage Service.

Provides a 100% self-contained local SQLite database engine for Galvaniy Labs,
storing users, reports, manual pages, settings, and lab sessions on the VPS.
"""

import json
import os
import sqlite3
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from app.models.user import UserProfile
from app.models.settings import GlobalSettings, AdminStats
from app.models.manual import ManualPage, ManualMetadata
from app.models.report import Report
from app.models.session import LabSessionResponse, AdminLabSessionResponse, SessionEvent

logger = logging.getLogger(__name__)


class SQLiteService:
    """Manages SQLite database operations for Galvaniy Labs."""

    def __init__(self, db_path: Optional[str] = None):
        if db_path is None:
            backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            db_path = os.path.join(backend_dir, "galvaniy.db")
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        """Create required tables if they do not exist."""
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    data TEXT NOT NULL,
                    updated_at TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS manual_metadata (
                    id TEXT PRIMARY KEY,
                    data TEXT NOT NULL
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS manual_pages (
                    id TEXT PRIMARY KEY,
                    page_number INTEGER NOT NULL,
                    text TEXT,
                    image TEXT
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    uid TEXT PRIMARY KEY,
                    email TEXT NOT NULL,
                    role TEXT DEFAULT 'student',
                    display_name TEXT,
                    photo_url TEXT,
                    custom_limit INTEGER,
                    is_revoked INTEGER DEFAULT 0,
                    reports_generated INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    last_login TEXT NOT NULL
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS reports (
                    id TEXT PRIMARY KEY,
                    experiment_code TEXT NOT NULL,
                    date TEXT NOT NULL,
                    content TEXT NOT NULL,
                    user_uid TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS lab_sessions (
                    id TEXT PRIMARY KEY,
                    user_uid TEXT NOT NULL,
                    data TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_reports_user ON reports(user_uid)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user ON lab_sessions(user_uid)")
            conn.commit()

    @staticmethod
    def _isoformat(value: Any) -> str:
        if value is None:
            return ""
        if isinstance(value, datetime):
            return value.replace(tzinfo=None).isoformat()
        return str(value)

    # ==================== SETTINGS ====================

    async def get_settings(self) -> GlobalSettings:
        try:
            with self._get_connection() as conn:
                row = conn.execute("SELECT data FROM settings WHERE key = 'global'").fetchone()
                if row:
                    data = json.loads(row["data"])
                    return GlobalSettings(
                        default_daily_limit=data.get("defaultDailyLimit", 3),
                        custom_instructions=data.get("customInstructions", ""),
                        api_provider=data.get("apiProvider", "gemini"),
                        custom_api_url=data.get("customApiUrl", ""),
                        enable_parallel_generation=data.get("enableParallelGeneration", True),
                        last_updated=data.get("lastUpdated"),
                        updated_by=data.get("updatedBy", ""),
                    )
            return GlobalSettings()
        except Exception as e:
            logger.error(f"[SQLite] Error getting settings: {e}")
            return GlobalSettings()

    async def update_settings(self, settings: Dict[str, Any], admin_email: str) -> None:
        try:
            with self._get_connection() as conn:
                current_settings = await self.get_settings()
                data = current_settings.model_dump()
                for k, v in settings.items():
                    if v is not None:
                        data[k] = v
                data["lastUpdated"] = datetime.utcnow().isoformat()
                data["updatedBy"] = admin_email

                conn.execute(
                    "INSERT INTO settings (key, data, updated_at) VALUES ('global', ?, ?) "
                    "ON CONFLICT(key) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
                    (json.dumps(data), data["lastUpdated"])
                )
                conn.commit()
        except Exception as e:
            logger.error(f"[SQLite] Error updating settings: {e}")
            raise

    # ==================== MANUAL ====================

    async def get_manual_metadata(self) -> Optional[ManualMetadata]:
        try:
            with self._get_connection() as conn:
                row = conn.execute("SELECT data FROM manual_metadata WHERE id = 'metadata'").fetchone()
                if row:
                    data = json.loads(row["data"])
                    return ManualMetadata(
                        name=data.get("name", ""),
                        uploaded_at=data.get("uploadedAt"),
                        uploaded_by=data.get("uploadedBy", ""),
                        version=data.get("version", 1),
                        page_count=data.get("pageCount", 0),
                    )
            return None
        except Exception as e:
            logger.error(f"[SQLite] Error getting manual metadata: {e}")
            return None

    async def get_manual_pages(self) -> List[ManualPage]:
        try:
            with self._get_connection() as conn:
                rows = conn.execute("SELECT id, page_number, text, image FROM manual_pages ORDER BY page_number ASC").fetchall()
                return [
                    ManualPage(
                        id=row["id"],
                        page_number=row["page_number"],
                        text=row["text"] or "",
                        image=row["image"],
                    )
                    for row in rows
                ]
        except Exception as e:
            logger.error(f"[SQLite] Error getting manual pages: {e}")
            return []

    async def save_manual(self, metadata: ManualMetadata, pages: List[ManualPage]) -> None:
        try:
            with self._get_connection() as conn:
                # Save metadata
                meta_dict = metadata.model_dump()
                conn.execute(
                    "INSERT INTO manual_metadata (id, data) VALUES ('metadata', ?) "
                    "ON CONFLICT(id) DO UPDATE SET data = excluded.data",
                    (json.dumps(meta_dict),)
                )
                # Delete existing pages
                conn.execute("DELETE FROM manual_pages")
                # Insert pages
                for p in pages:
                    conn.execute(
                        "INSERT INTO manual_pages (id, page_number, text, image) VALUES (?, ?, ?, ?)",
                        (p.id, p.page_number, p.text, p.image)
                    )
                conn.commit()
        except Exception as e:
            logger.error(f"[SQLite] Error saving manual: {e}")
            raise

    async def upload_manual(self, pages: List[ManualPage], file_name: str, admin_email: str) -> None:
        try:
            current_meta = await self.get_manual_metadata()
            new_version = current_meta.version + 1 if current_meta else 1
            meta = ManualMetadata(
                name=file_name,
                uploaded_at=datetime.utcnow().isoformat(),
                uploaded_by=admin_email,
                version=new_version,
                page_count=len(pages),
            )
            await self.save_manual(meta, pages)
        except Exception as e:
            logger.error(f"[SQLite] Error uploading manual: {e}")
            raise

    async def clear_manual(self) -> None:
        try:
            with self._get_connection() as conn:
                conn.execute("DELETE FROM manual_pages")
                conn.execute("DELETE FROM manual_metadata")
                conn.commit()
        except Exception as e:
            logger.error(f"[SQLite] Error clearing manual: {e}")
            raise

    # ==================== USER PROFILES ====================

    async def get_user_profile(self, uid: str) -> Optional[UserProfile]:
        try:
            with self._get_connection() as conn:
                row = conn.execute("SELECT * FROM users WHERE uid = ?", (uid,)).fetchone()
                if row:
                    try:
                        created_at = datetime.fromisoformat(row["created_at"])
                    except Exception:
                        created_at = datetime.utcnow()
                    try:
                        last_login = datetime.fromisoformat(row["last_login"])
                    except Exception:
                        last_login = datetime.utcnow()

                    return UserProfile(
                        uid=row["uid"],
                        email=row["email"],
                        role=row["role"] or "student",
                        display_name=row["display_name"],
                        photo_url=row["photo_url"],
                        custom_limit=row["custom_limit"],
                        is_revoked=bool(row["is_revoked"]),
                        reports_generated=row["reports_generated"] or 0,
                        created_at=created_at,
                        last_login=last_login,
                    )
            return None
        except Exception as e:
            logger.error(f"[SQLite] Error getting user profile: {e}")
            return None

    async def create_user_profile(self, profile: UserProfile) -> None:
        try:
            now_iso = datetime.utcnow().isoformat()
            created_at_iso = profile.created_at.isoformat() if isinstance(profile.created_at, datetime) else now_iso
            last_login_iso = profile.last_login.isoformat() if isinstance(profile.last_login, datetime) else now_iso

            with self._get_connection() as conn:
                conn.execute("""
                    INSERT INTO users (
                        uid, email, role, display_name, photo_url, custom_limit, is_revoked, reports_generated, created_at, last_login
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(uid) DO UPDATE SET
                        email = excluded.email,
                        role = excluded.role,
                        display_name = COALESCE(excluded.display_name, users.display_name),
                        photo_url = COALESCE(excluded.photo_url, users.photo_url),
                        last_login = excluded.last_login
                """, (
                    profile.uid,
                    profile.email,
                    profile.role,
                    profile.display_name,
                    profile.photo_url,
                    profile.custom_limit,
                    1 if profile.is_revoked else 0,
                    profile.reports_generated,
                    created_at_iso,
                    last_login_iso,
                ))
                conn.commit()
        except Exception as e:
            logger.error(f"[SQLite] Error creating user profile: {e}")
            raise

    async def update_user_profile(self, uid: str, updates: Dict[str, Any]) -> None:
        try:
            field_mapping = {
                "custom_limit": "custom_limit",
                "is_revoked": "is_revoked",
                "reports_generated": "reports_generated",
                "role": "role",
                "display_name": "display_name",
                "photo_url": "photo_url",
            }
            clauses = []
            values = []
            for k, col in field_mapping.items():
                if k in updates and updates[k] is not None:
                    val = updates[k]
                    if isinstance(val, bool):
                        val = 1 if val else 0
                    clauses.append(f"{col} = ?")
                    values.append(val)

            if clauses:
                values.append(uid)
                sql = f"UPDATE users SET {', '.join(clauses)} WHERE uid = ?"
                with self._get_connection() as conn:
                    conn.execute(sql, tuple(values))
                    conn.commit()
        except Exception as e:
            logger.error(f"[SQLite] Error updating user profile: {e}")
            raise

    async def get_all_users(self) -> List[UserProfile]:
        try:
            with self._get_connection() as conn:
                rows = conn.execute("SELECT * FROM users ORDER BY created_at DESC").fetchall()
                users = []
                for row in rows:
                    try:
                        created_at = datetime.fromisoformat(row["created_at"])
                    except Exception:
                        created_at = datetime.utcnow()
                    try:
                        last_login = datetime.fromisoformat(row["last_login"])
                    except Exception:
                        last_login = datetime.utcnow()

                    users.append(UserProfile(
                        uid=row["uid"],
                        email=row["email"],
                        role=row["role"] or "student",
                        display_name=row["display_name"],
                        photo_url=row["photo_url"],
                        custom_limit=row["custom_limit"],
                        is_revoked=bool(row["is_revoked"]),
                        reports_generated=row["reports_generated"] or 0,
                        created_at=created_at,
                        last_login=last_login,
                    ))
                return users
        except Exception as e:
            logger.error(f"[SQLite] Error getting all users: {e}")
            return []

    async def toggle_user_revoke(self, uid: str, is_revoked: bool) -> None:
        await self.update_user_profile(uid, {"is_revoked": is_revoked})

    async def increment_report_count(self, uid: str) -> None:
        try:
            with self._get_connection() as conn:
                conn.execute(
                    "UPDATE users SET reports_generated = COALESCE(reports_generated, 0) + 1 WHERE uid = ?",
                    (uid,)
                )
                conn.commit()
        except Exception as e:
            logger.error(f"[SQLite] Error incrementing report count: {e}")
            raise

    async def update_last_login(self, uid: str) -> None:
        try:
            with self._get_connection() as conn:
                conn.execute(
                    "UPDATE users SET last_login = ? WHERE uid = ?",
                    (datetime.utcnow().isoformat(), uid)
                )
                conn.commit()
        except Exception as e:
            logger.error(f"[SQLite] Error updating last login: {e}")

    # ==================== REPORTS ====================

    async def save_report(self, user_uid: str, report: Report) -> None:
        try:
            with self._get_connection() as conn:
                conn.execute("""
                    INSERT INTO reports (id, experiment_code, date, content, user_uid, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        experiment_code = excluded.experiment_code,
                        date = excluded.date,
                        content = excluded.content,
                        created_at = excluded.created_at
                """, (
                    report.id,
                    report.experiment_code,
                    report.date,
                    report.content,
                    user_uid,
                    datetime.utcnow().isoformat()
                ))
                conn.commit()
        except Exception as e:
            logger.error(f"[SQLite] Error saving report: {e}")
            raise

    async def get_user_reports(self, user_uid: str) -> List[Report]:
        try:
            with self._get_connection() as conn:
                rows = conn.execute(
                    "SELECT id, experiment_code, date, content, user_uid FROM reports WHERE user_uid = ? ORDER BY created_at DESC",
                    (user_uid,)
                ).fetchall()
                return [
                    Report(
                        id=row["id"],
                        experiment_code=row["experiment_code"],
                        date=row["date"],
                        content=row["content"],
                        user_uid=row["user_uid"],
                    )
                    for row in rows
                ]
        except Exception as e:
            logger.error(f"[SQLite] Error getting user reports: {e}")
            return []

    # ==================== LAB SESSIONS ====================

    def _serialize_session(self, doc_id: str, data: Dict[str, Any]) -> LabSessionResponse:
        raw_events = data.get("session_events") or data.get("sessionEvents") or []
        events: List[SessionEvent] = []
        for event in raw_events:
            if isinstance(event, SessionEvent):
                events.append(event)
            elif isinstance(event, dict):
                events.append(
                    SessionEvent(
                        time=float(event.get("time", 0) or 0),
                        type=str(event.get("type", "")),
                        data=event.get("data", {}) if isinstance(event.get("data", {}), dict) else {},
                    )
                )

        data_points = data.get("data_points") or data.get("dataPoints") or []
        control_values = data.get("control_values") or data.get("controlValues") or {}
        saved_at = (
            data.get("saved_at")
            or data.get("savedAt")
            or self._isoformat(data.get("createdAt"))
        )

        return LabSessionResponse(
            id=data.get("id", doc_id),
            user_uid=data.get("user_uid", data.get("userUid", "")),
            experiment_code=data.get("experiment_code", data.get("experimentCode", "")),
            mode=data.get("mode", "manual"),
            started_at=data.get("started_at", data.get("startedAt", "")),
            completed_at=data.get("completed_at", data.get("completedAt", "")),
            saved_at=saved_at,
            data_points=data_points if isinstance(data_points, list) else [],
            control_values=control_values if isinstance(control_values, dict) else {},
            session_events=events,
            data_point_count=len(data_points) if isinstance(data_points, list) else 0,
        )

    async def save_lab_session(self, user_uid: str, session_data: Dict[str, Any]) -> str:
        try:
            session_id = f"{user_uid}_{int(datetime.utcnow().timestamp() * 1000)}"
            session_data["id"] = session_id
            session_data["user_uid"] = user_uid
            session_data["createdAt"] = datetime.utcnow().isoformat()

            with self._get_connection() as conn:
                conn.execute(
                    "INSERT INTO lab_sessions (id, user_uid, data, created_at) VALUES (?, ?, ?, ?)",
                    (session_id, user_uid, json.dumps(session_data), session_data["createdAt"])
                )
                conn.commit()
            return session_id
        except Exception as e:
            logger.error(f"[SQLite] Error saving lab session: {e}")
            raise

    async def get_user_lab_sessions(self, user_uid: str, limit: int = 50) -> List[LabSessionResponse]:
        try:
            with self._get_connection() as conn:
                rows = conn.execute(
                    "SELECT id, data FROM lab_sessions WHERE user_uid = ? ORDER BY created_at DESC LIMIT ?",
                    (user_uid, limit)
                ).fetchall()
                sessions = []
                for row in rows:
                    data = json.loads(row["data"])
                    sessions.append(self._serialize_session(row["id"], data))
                return sessions
        except Exception as e:
            logger.error(f"[SQLite] Error getting user lab sessions: {e}")
            return []

    async def get_lab_session(self, session_id: str) -> Optional[LabSessionResponse]:
        try:
            with self._get_connection() as conn:
                row = conn.execute("SELECT id, data FROM lab_sessions WHERE id = ?", (session_id,)).fetchone()
                if row:
                    data = json.loads(row["data"])
                    return self._serialize_session(row["id"], data)
            return None
        except Exception as e:
            logger.error(f"[SQLite] Error getting lab session {session_id}: {e}")
            return None

    async def get_all_lab_sessions(self, limit: int = 100) -> List[AdminLabSessionResponse]:
        try:
            with self._get_connection() as conn:
                rows = conn.execute(
                    "SELECT id, data FROM lab_sessions ORDER BY created_at DESC LIMIT ?",
                    (limit,)
                ).fetchall()
                sessions: List[AdminLabSessionResponse] = []
                for row in rows:
                    session = self._serialize_session(row["id"], json.loads(row["data"]))
                    profile = await self.get_user_profile(session.user_uid)
                    sessions.append(
                        AdminLabSessionResponse(
                            **session.model_dump(),
                            user_email=profile.email if profile else "",
                            display_name=profile.display_name if profile else None,
                        )
                    )
                return sessions
        except Exception as e:
            logger.error(f"[SQLite] Error getting admin lab sessions: {e}")
            return []

    # ==================== ADMIN STATS ====================

    async def get_admin_stats(self) -> AdminStats:
        try:
            users = await self.get_all_users()
            students = [u for u in users if u.role == "student"]
            sessions = await self.get_all_lab_sessions(limit=5000)

            return AdminStats(
                total_students=len(students),
                total_reports=sum(u.reports_generated for u in students),
                active_students=len([u for u in students if not u.is_revoked]),
                revoked_students=len([u for u in students if u.is_revoked]),
                total_lab_sessions=len(sessions),
                manual_lab_sessions=len([s for s in sessions if s.mode == "manual"]),
                auto_lab_sessions=len([s for s in sessions if s.mode == "auto"]),
                students_using_virtual_lab=len({s.user_uid for s in sessions if s.user_uid}),
            )
        except Exception as e:
            logger.error(f"[SQLite] Error getting admin stats: {e}")
            return AdminStats()


# Module-level singleton
sqlite_service = SQLiteService()
