import asyncio
import json
import sys

import edge_tts


async def main() -> None:
    voice = sys.argv[1]
    rate = sys.argv[2]
    text = sys.argv[3]
    out_mp3 = sys.argv[4]
    out_json = sys.argv[5]

    communicate = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    words = []
    audio_parts = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_parts.append(chunk["data"])
        elif chunk["type"] == "WordBoundary":
            words.append(
                {
                    "text": chunk["text"],
                    "offset": chunk["offset"],
                    "duration": chunk["duration"],
                }
            )

    audio = b"".join(audio_parts)
    with open(out_mp3, "wb") as f:
        f.write(audio)
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False)


if __name__ == "__main__":
    asyncio.run(main())
