import os

from google import genai

api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise RuntimeError("Set GEMINI_API_KEY or GOOGLE_API_KEY before running this script.")

client = genai.Client(api_key=api_key)

response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="Hello Gemini, reply in one sentence."
)

print(response.text)
