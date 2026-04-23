import asyncio
import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

async def test_model(model_name):
    api_key = os.getenv("GEMINI_API_KEY")
    print(f"Using key ending in: {api_key[-5:]}")
    client = genai.Client(api_key=api_key)
    
    manual_text = "This is a dummy lab manual about physics. " * 50
    print(f"\n--- Testing {model_name} ---")
    
    try:
        response = client.models.generate_content(
            model=model_name,
            contents=manual_text,
        )
        print("Success! Response:", response.text[:50])
    except Exception as e:
        print("Failed:", str(e))

async def main():
    await test_model('gemini-1.5-flash')
    await test_model('gemini-2.0-flash')

if __name__ == "__main__":
    asyncio.run(main())
