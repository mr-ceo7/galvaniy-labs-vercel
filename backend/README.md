# Galvaniy Labs Backend API

Python FastAPI backend for AI-powered lab report generation.

## Quick Start

```bash
# 1. Create virtual environment
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 4. Run the server
uvicorn app.main:app --reload --port 8001

# 5. Run tests
python -m pytest tests/ -v
```

## API Endpoints

### Health
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Health check | None |

### Auth
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/auth/me` | Get current user | Bearer |
| POST | `/api/auth/profile` | Create/update profile | Bearer |

### Reports
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/reports/generate` | Generate a lab report | Bearer |
| GET | `/api/reports` | List user's reports | Bearer |

### Admin
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/admin/users` | List all users | Admin |
| PATCH | `/api/admin/users/{uid}` | Update user | Admin |
| GET | `/api/admin/stats` | Dashboard stats | Admin |
| GET | `/api/admin/settings` | Get settings | Admin |
| PUT | `/api/admin/settings` | Update settings | Admin |
| POST | `/api/admin/manual/upload` | Upload manual PDF | Admin |
| DELETE | `/api/admin/manual` | Clear manual | Admin |
| GET | `/api/admin/manual/metadata` | Manual info | Admin |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON | For production |
| `CORS_ORIGINS` | Comma-separated allowed origins | No (default: localhost:3000) |
| `PORT` | Server port | No (default: 8001) |
| `ADMIN_EMAILS` | Comma-separated admin email addresses | No |

## Architecture

```
backend/
├── app/
│   ├── main.py              # FastAPI entry point
│   ├── config.py             # Settings (env vars)
│   ├── dependencies.py       # Firebase & Gemini singletons
│   ├── middleware/
│   │   └── auth.py           # Firebase token verification
│   ├── models/               # Pydantic models
│   ├── routers/              # API endpoints
│   ├── services/             # Business logic
│   └── utils/                # Rate limiter, etc.
└── tests/                    # Unit tests (93 tests)
```

## Deployment

Deploy behind a reverse proxy (nginx) on port 8001:

```bash
# Production
uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers 4
```

Update `vercel.json` to proxy to port 8001 for the new backend endpoints.
