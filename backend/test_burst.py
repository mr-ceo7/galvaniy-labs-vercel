import asyncio
import os
import logging
from dotenv import load_dotenv
from google import genai

from app.services.gemini_service import generate_lab_report

# Configure logging
logging.basicConfig(level=logging.INFO)

load_dotenv()

async def main():
    api_key = os.getenv("GEMINI_API_KEY")
    client = genai.Client(api_key=api_key)
    
    manual_text = "This is a dummy lab manual about physics. " * 1000
    experiment_code = "PHY101"
    
    print("Testing Sequential (Queued) Generation...")
    try:
        res = await generate_lab_report(client, manual_text, experiment_code, parallel=False)
        print("Sequential Success! Length:", len(res))
    except Exception as e:
        print("Sequential Failed:", str(e))

if __name__ == "__main__":
    asyncio.run(main())
