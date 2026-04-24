import asyncio
import httpx
async def main():
    try:
        async with httpx.AsyncClient(timeout=0.0001) as client:
            await client.get("http://example.com")
    except Exception as e:
        print("EXCEPTION TYPE:", type(e))
        print("STR:", repr(str(e)))
asyncio.run(main())
