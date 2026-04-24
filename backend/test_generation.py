import asyncio
import os
import logging
from dotenv import load_dotenv

from app.routers.reports import _generate_report_content

# Configure logging
logging.basicConfig(level=logging.INFO)

load_dotenv()

class DummySettings:
    api_provider = "gemini"
    enable_parallel_generation = False

async def main():
    manual_text = "This is a dummy lab manual about specific heat capacity."
    experiment_code = "C-11"
    
    print("Testing Generation for C-11...")
    try:
        res = await _generate_report_content(manual_text, experiment_code, parallel=False, settings=DummySettings())
        print("Success! Length:", len(res))
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
