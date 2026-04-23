import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
print(f"Testing with API Key ending in: ...{api_key[-5:] if api_key else 'NONE'}")

try:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents='Hello, give me a very short response, just the word "SUCCESS".',
    )
    print("API Response:", response.text)
except Exception as e:
    print("Error during API call:", str(e))
