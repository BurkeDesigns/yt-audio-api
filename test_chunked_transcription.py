"""
Test script for chunked transcription with infinite length support
"""

import requests
import time
import sys
import json
from datetime import datetime
from pathlib import Path

BASE_URL = "http://localhost:5001"

def test_chunked_transcription(youtube_url):
    """Test the new chunked transcription system."""
    
    print(f"\n{'='*70}")
    print(f"🧪 Testing Chunked Transcription System")
    print(f"{'='*70}\n")
    print(f"URL: {youtube_url}\n")
    
    # Step 1: Download
    print("📥 Step 1: Downloading audio...")
    download_start = time.time()
    
    try:
        response = requests.get(f"{BASE_URL}/", params={"url": youtube_url}, timeout=300)
        download_time = time.time() - download_start
        
        if response.status_code != 200:
            print(f"❌ Download failed: {response.json()}")
            return
        
        token = response.json()["token"]
        print(f"✅ Download completed in {download_time:.1f}s")
        print(f"   Token: {token}\n")
        
    except Exception as e:
        print(f"❌ Download error: {e}")
        return
    
    # Step 2: Get file size
    print("📊 Step 2: Checking file info...")
    try:
        verify_response = requests.head(f"{BASE_URL}/download", params={"token": token})
        if verify_response.status_code == 200:
            file_size = int(verify_response.headers.get('Content-Length', 0))
            file_size_mb = file_size / (1024 * 1024)
            print(f"   File size: {file_size_mb:.1f} MB")
            print(f"   Duration estimate: ~{file_size_mb:.0f} minutes")
            print()
    except Exception as e:
        print(f"   Could not get file info: {e}\n")
    
    # Step 3: Transcribe with chunking
    print("🎤 Step 3: Transcribing with chunked processing...")
    print("   (Watch the server terminal for detailed progress)\n")
    
    transcribe_start = time.time()
    
    try:
        # Use JSON format to see metadata
        response = requests.get(
            f"{BASE_URL}/transcribe",
            params={"token": token, "format": "json"},
            timeout=3600  # 1 hour timeout for very long files
        )
        
        transcribe_time = time.time() - transcribe_start
        
        if response.status_code != 200:
            error_data = response.json()
            print(f"\n❌ Transcription failed: {error_data}")
            return
        
        result = response.json()
        
        print(f"\n✅ Transcription completed!")
        print(f"\n{'='*70}")
        print("📊 Results")
        print(f"{'='*70}")
        
        # Show metadata
        if 'metadata' in result:
            meta = result['metadata']
            print(f"Download time:       {download_time:.1f}s")
            print(f"Transcription time:  {transcribe_time:.1f}s")
            print(f"Total time:         {download_time + transcribe_time:.1f}s")
            print(f"File size:          {meta.get('file_size_mb', 0):.1f} MB")
            print(f"Processing speed:   {meta.get('processing_speed_mb_per_sec', 0):.2f} MB/s")
            print(f"Chunks processed:   {meta.get('chunks_processed', 0)}")
            print(f"Silence removed:    {meta.get('silence_removed', False)}")
        
        # Show transcription
        print(f"\n{'='*70}")
        print("📝 Transcription Preview (first 500 chars)")
        print(f"{'='*70}\n")
        transcription = result.get('transcription', '')
        print(transcription[:500])
        if len(transcription) > 500:
            print("...\n")
        
        print(f"\nTotal sentences: {len(result.get('sentences', []))}")
        print(f"Total characters: {len(transcription)}")
        
        # Show first few sentences with timestamps
        if result.get('sentences'):
            print(f"\n{'='*70}")
            print("🕐 First 3 Sentences with Timestamps")
            print(f"{'='*70}\n")
            for i, sentence in enumerate(result['sentences'][:3], 1):
                start = sentence['start']
                end = sentence['end']
                text = sentence['text']
                print(f"{i}. [{start:.1f}s - {end:.1f}s]")
                print(f"   {text}\n")
        
        print(f"{'='*70}\n")
        print(f"✅ Test completed successfully!")
        print(f"\n💡 The chunked system can now handle audio of any length!")
        
        # Save results to files
        print(f"\n{'='*70}")
        print("💾 Saving Results")
        print(f"{'='*70}\n")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = Path("transcriptions")
        output_dir.mkdir(exist_ok=True)
        
        # Save plain text transcription
        txt_file = output_dir / f"transcription_{timestamp}.txt"
        with open(txt_file, 'w', encoding='utf-8') as f:
            f.write(f"YouTube Audio Transcription\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Token: {token}\n")
            f.write(f"{'='*70}\n\n")
            f.write(transcription)
        print(f"✅ Text saved: {txt_file}")
        
        # Save JSON with timestamps
        json_file = output_dir / f"transcription_{timestamp}.json"
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
        print(f"✅ JSON saved: {json_file}")
        
        # Get and save SRT subtitles
        try:
            srt_response = requests.get(
                f"{BASE_URL}/transcribe",
                params={"token": token, "format": "srt"},
                timeout=60
            )
            if srt_response.status_code == 200:
                srt_file = output_dir / f"transcription_{timestamp}.srt"
                with open(srt_file, 'w', encoding='utf-8') as f:
                    f.write(srt_response.text)
                print(f"✅ SRT saved: {srt_file}")
        except Exception as e:
            print(f"⚠️  Could not save SRT: {e}")
        
        # Save summary
        summary_file = output_dir / f"summary_{timestamp}.txt"
        with open(summary_file, 'w', encoding='utf-8') as f:
            f.write(f"Transcription Summary\n")
            f.write(f"{'='*70}\n\n")
            f.write(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"Token: {token}\n\n")
            f.write(f"Performance Metrics:\n")
            f.write(f"  Download time:       {download_time:.1f}s\n")
            f.write(f"  Transcription time:  {transcribe_time:.1f}s\n")
            f.write(f"  Total time:         {download_time + transcribe_time:.1f}s\n")
            if 'metadata' in result:
                meta = result['metadata']
                f.write(f"  File size:          {meta.get('file_size_mb', 0):.1f} MB\n")
                f.write(f"  Processing speed:   {meta.get('processing_speed_mb_per_sec', 0):.2f} MB/s\n")
                f.write(f"  Chunks processed:   {meta.get('chunks_processed', 0)}\n")
                f.write(f"  Silence removed:    {meta.get('silence_removed', False)}\n")
            f.write(f"\nContent Statistics:\n")
            f.write(f"  Total sentences:    {len(result.get('sentences', []))}\n")
            f.write(f"  Total characters:   {len(transcription)}\n")
            f.write(f"  Total words:        {len(transcription.split())}\n\n")
            f.write(f"Files Generated:\n")
            f.write(f"  - {txt_file.name}\n")
            f.write(f"  - {json_file.name}\n")
            f.write(f"  - {srt_file.name if 'srt_file' in locals() else 'N/A'}\n")
        print(f"✅ Summary saved: {summary_file}")
        
        print(f"\n{'='*70}")
        print(f"📁 All files saved to: {output_dir.absolute()}")
        print(f"{'='*70}\n")
        
        return result
        
    except requests.exceptions.Timeout:
        transcribe_time = time.time() - transcribe_start
        print(f"\n❌ Timeout after {transcribe_time:.1f}s")
        return None
    except Exception as e:
        print(f"\n❌ Error: {e}")
        return None


if __name__ == "__main__":
    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        print("\n🧪 Chunked Transcription Test")
        print("=" * 70)
        print("\nThis tests the new chunked processing system that can handle")
        print("infinite length audio by splitting it into manageable chunks.\n")
        
        url = input("Enter YouTube URL: ").strip()
        if not url:
            print("❌ No URL provided")
            sys.exit(1)
    
    print("\n⚠️  Make sure the Flask server is running on http://localhost:5001")
    input("Press Enter to start test...")
    
    try:
        test_chunked_transcription(url)
    except KeyboardInterrupt:
        print("\n\n⚠️  Test interrupted by user")
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
