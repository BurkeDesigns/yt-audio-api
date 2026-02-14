"""
Example usage of the YouTube Audio API with Transcription

This script demonstrates how to:
1. Download audio from a YouTube video
2. Get the audio file
3. Transcribe the audio with AI
4. Save the transcription results

Make sure the Flask server is running before executing this script.
"""

import requests
import time
import json
from datetime import datetime
from pathlib import Path

# API Configuration
BASE_URL = "http://localhost:5001"

def download_and_transcribe(youtube_url):
    """
    Complete workflow: Download YouTube audio and transcribe it
    
    Args:
        youtube_url: YouTube video URL
        
    Returns:
        dict with audio token and transcription results
    """
    
    print(f"\n{'='*60}")
    print(f"Processing: {youtube_url}")
    print(f"{'='*60}\n")
    
    # Step 1: Request audio download and get token
    print("Step 1: Requesting audio download...")
    download_start = time.time()
    response = requests.get(f"{BASE_URL}/", params={"url": youtube_url})
    download_end = time.time()
    download_duration = download_end - download_start
    
    if response.status_code != 200:
        print(f"❌ Error: {response.json()}")
        return None
    
    token = response.json()["token"]
    print(f"✓ Token received: {token}")
    print(f"✓ Audio download completed!")
    print(f"⏱️  Download time: {download_duration:.2f} seconds\n")
    
    # Brief pause to ensure everything is settled
    time.sleep(1)
    
    # Verify the download endpoint works (it returns the file, not JSON)
    print("\nVerifying audio file is accessible...")
    verify_response = requests.head(f"{BASE_URL}/download", params={"token": token})
    if verify_response.status_code != 200:
        print(f"❌ Download verification failed with status {verify_response.status_code}")
        return None
    print("✓ Audio file verified and accessible")
    
    # Step 2: Get plain text transcription
    print("\nStep 2: Requesting transcription (plain text)...")
    transcription_start = time.time()
    response = requests.get(f"{BASE_URL}/transcribe", params={
        "token": token,
        "format": "text"
    })
    transcription_end = time.time()
    transcription_duration = transcription_end - transcription_start
    
    if response.status_code != 200:
        print(f"❌ Transcription error: {response.json()}")
        return None
    
    transcription_text = response.json()["transcription"]
    print(f"✓ Transcription completed!")
    print(f"⏱️  Transcription time: {transcription_duration:.2f} seconds")
    print(f"📝 Text: {transcription_text}\n")
    
    # Step 3: Get detailed transcription with timestamps
    print("\nStep 3: Requesting detailed transcription (JSON with timestamps)...")
    detailed_start = time.time()
    response = requests.get(f"{BASE_URL}/transcribe", params={
        "token": token,
        "format": "json"
    })
    detailed_end = time.time()
    detailed_duration = detailed_end - detailed_start
    
    if response.status_code == 200:
        detailed = response.json()
        print(f"✓ Detailed transcription received!")
        print(f"⏱️  Detailed transcription time: {detailed_duration:.2f} seconds")
        print(f"\n{'='*60}")
        print("SENTENCES WITH TIMESTAMPS:")
        print(f"{'='*60}\n")
        
        for i, sentence in enumerate(detailed["sentences"], 1):
            start = sentence["start"]
            end = sentence["end"]
            text = sentence["text"]
            duration = sentence["duration"]
            print(f"{i}. [{start:.2f}s - {end:.2f}s] ({duration:.2f}s)")
            print(f"   \"{text}\"")
            print()
    
    # Step 4: Get SRT subtitle format
    print("Step 4: Requesting SRT subtitle format...")
    response = requests.get(f"{BASE_URL}/transcribe", params={
        "token": token,
        "format": "srt"
    })
    
    srt_content = ""
    if response.status_code == 200:
        srt_content = response.text
        print(f"✓ SRT subtitle format received!")
        print(f"\n{'='*60}")
        print("SRT SUBTITLE FORMAT (first 500 chars):")
        print(f"{'='*60}\n")
        print(srt_content[:500])
        if len(srt_content) > 500:
            print("\n... (truncated)")
    
    print(f"\n{'='*60}")
    print("✅ All operations completed successfully!")
    print(f"{'='*60}")
    print(f"\n📊 PERFORMANCE SUMMARY:")
    print(f"   • Audio download: {download_duration:.2f}s")
    print(f"   • Text transcription: {transcription_duration:.2f}s")
    print(f"   • Detailed transcription: {detailed_duration:.2f}s")
    print(f"   • Total time: {download_duration + transcription_duration + detailed_duration:.2f}s\n")
    
    # Save results
    print(f"\n{'='*60}")
    print("💾 SAVING RESULTS")
    print(f"{'='*60}\n")
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path("transcriptions")
    output_dir.mkdir(exist_ok=True)
    
    # Save plain text
    txt_file = output_dir / f"transcription_{timestamp}.txt"
    with open(txt_file, 'w', encoding='utf-8') as f:
        f.write(transcription_text)
    print(f"✅ Text: {txt_file}")
    
    # Save detailed JSON
    json_file = output_dir / f"transcription_{timestamp}.json"
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(detailed, f, indent=2, ensure_ascii=False)
    print(f"✅ JSON: {json_file}")
    
    # Save SRT
    if srt_content:
        srt_file = output_dir / f"transcription_{timestamp}.srt"
        with open(srt_file, 'w', encoding='utf-8') as f:
            f.write(srt_content)
        print(f"✅ SRT:  {srt_file}")
    
    print(f"\n📁 Files saved to: {output_dir.absolute()}\n")
    
    return {
        "token": token,
        "transcription": transcription_text,
        "detailed": detailed,
        "timings": {
            "download": download_duration,
            "transcription": transcription_duration,
            "detailed": detailed_duration
        },
        "files": {
            "text": str(txt_file),
            "json": str(json_file),
            "srt": str(srt_file) if srt_content else None
        }
    }


if __name__ == "__main__":
    # Example: Short video for testing
    # Replace with your own YouTube URL
    # test_url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    test_url = "https://www.youtube.com/watch?v=JwsergVfal0"
    
    print("\n🎧 YouTube Audio API - Transcription Demo")
    print("=========================================\n")
    print("NOTE: Make sure the Flask server is running on http://localhost:5001")
    print("      Start it with: python3 main.py")
    
    input("\nPress Enter to continue...")
    
    try:
        result = download_and_transcribe(test_url)
        
        if result:
            print("\n💡 TIP: You can also download the audio file directly:")
            print(f"   curl \"{BASE_URL}/download?token={result['token']}\" -O")
            
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: Could not connect to the API server.")
        print("   Make sure the Flask server is running on http://localhost:5001")
        print("   Start it with: python3 main.py")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
