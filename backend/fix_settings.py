import asyncio
from app.services.firestore_service import firestore_service

async def disable_parallel():
    settings = await firestore_service.get_settings()
    print("Current settings:", settings)
    
    from app.models.settings import GlobalSettingsUpdate
    update = GlobalSettingsUpdate(enable_parallel_generation=False)
    await firestore_service.update_settings(update, admin_email="system@localhost")
    print("Updated settings to Queued generation!")

if __name__ == "__main__":
    asyncio.run(disable_parallel())
