"""
Script for transcribing large audio files with progress monitoring.
This script provides better feedback and error handling for long transcriptions.
"""

import requests
import time
import sys

BASE_URL = "http://localhost:5001"

def format_time(seconds):
    """Format seconds into human-readable time."""
    if seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        minutes = seconds / 60
        return f"{minutes:.1f}m"
    else:
        hours = seconds / 3600
        return f"{hours:.2f}h"

def estimate_transcription_time(file_size_mb):
    """Estimate transcription time based on file size."""
    # Rough estimate: ~1-2 minutes per MB on Apple Silicon
    # Adjust based on your system performance
    estimated_seconds = file_size_mb * 60  # Conservative estimate
    return estimated_seconds

def transcribe_with_monitoring(youtube_url):
    """
    Download and transcribe audio with progress monitoring.
    """
    print(f"\n{'='*70}")
    print(f"🎥 YouTube Audio Transcription")
    print(f"{'='*70}\n")
    print(f"URL: {youtube_url}\n")
    
    # Step 1: Download audio
    print("📥 Step 1: Downloading audio...")
    download_start = time.time()
    
    try:
        response = requests.get(f"{BASE_URL}/", params={"url": youtube_url}, timeout=300)
        download_time = time.time() - download_start
        
        if response.status_code != 200:
            print(f"❌ Download failed: {response.json()}")
            return None
        
        token = response.json()["token"]
        print(f"✅ Download completed in {format_time(download_time)}")
        print(f"   Token: {token}\n")
        
    except requests.exceptions.Timeout:
        print("❌ Download timeout. The video may be too long or connection is slow.")
        return None
    except Exception as e:
        print(f"❌ Download error: {e}")
        return None
    
    # Step 2: Check file size
    print("📊 Step 2: Checking file size...")
    try:
        verify_response = requests.head(f"{BASE_URL}/download", params={"token": token})
        if verify_response.status_code != 200:
            print(f"❌ File verification failed")
            return None
        
        file_size = int(verify_response.headers.get('Content-Length', 0))
        file_size_mb = file_size / (1024 * 1024)
        print(f"   File size: {file_size_mb:.1f} MB")
        
        estimated_time = estimate_transcription_time(file_size_mb)
        print(f"   Estimated transcription time: {format_time(estimated_time)}")
        
        if file_size_mb > 500:
            print(f"\n⚠️  Warning: File exceeds 500MB limit. Transcription will fail.")
            return None
        elif file_size_mb > 100:
            print(f"\n⚠️  Warning: Large file detected. This will take a while...\n")
        else:
            print()
            
    except Exception as e:
        print(f"⚠️  Could not check file size: {e}\n")
    
    # Step 3: Transcribe
    print("🎤 Step 3: Transcribing audio...")
    print("   (This may take several minutes for large files...)")
    
    transcribe_start = time.time()
    
    try:
        # Use a very long timeout for large files
        timeout = max(600, estimated_time * 2)  # At least 10 minutes
        print(f"   Request timeout: {format_time(timeout)}\n")
        
        response = requests.get(
            f"{BASE_URL}/transcribe",
            params={"token": token, "format": "json"},
            timeout=timeout
        )
        
        transcribe_time = time.time() - transcribe_start
        
        if response.status_code != 200:
            error_data = response.json()
            print(f"\n❌ Transcription failed: {error_data.get('error', 'Unknown error')}")
            if 'detail' in error_data:
                print(f"   Details: {error_data['detail']}")
            if 'suggestion' in error_data:
                print(f"   💡 {error_data['suggestion']}")
            return None
        
        result = response.json()
        
        print(f"\n✅ Transcription completed!")
        print(f"\n{'='*70}")
        print("📊 Performance Summary")
        print(f"{'='*70}")
        print(f"Download time:        {format_time(download_time)}")
        print(f"Transcription time:   {format_time(transcribe_time)}")
        print(f"Total time:          {format_time(download_time + transcribe_time)}")
        
        if 'metadata' in result:
            meta = result['metadata']
            print(f"File size:           {meta.get('file_size_mb', 0):.1f} MB")
            print(f"Processing speed:    {meta.get('processing_speed_mb_per_sec', 0):.2f} MB/s")
        
        print(f"\n{'='*70}")
        print("📝 Transcription")
        print(f"{'='*70}\n")
        print(result['transcription'])
        print(f"\n{'='*70}")
        print(f"Total sentences: {len(result.get('sentences', []))}")
        print(f"{'='*70}\n")
        
        return result
        
    except requests.exceptions.Timeout:
        transcribe_time = time.time() - transcribe_start
        print(f"\n❌ Transcription timeout after {format_time(transcribe_time)}")
        print(f"   The file may be too large or the server is overloaded.")
        print(f"   💡 Try a shorter audio clip or increase the timeout.")
        return None
    except Exception as e:
        print(f"\n❌ Transcription error: {e}")
        return None


if __name__ == "__main__":
    if len(sys.argv) > 1:
        url = sys.argv[1]
    else:
        print("\n🎧 YouTube Audio Transcription - Large File Handler")
        print("=" * 70)
        print("\nThis script handles large audio files with better progress tracking.")
        print("\nUsage:")
        print("  python transcribe_large_file.py <youtube_url>")
        print("\nOr enter URL interactively:\n")
        
        url = input("Enter YouTube URL: ").strip()
        if not url:
            print("❌ No URL provided")
            sys.exit(1)
    
    print("\n⚠️  Make sure the Flask server is running on http://localhost:5001")
    input("Press Enter to continue...")
    
    try:
        result = transcribe_with_monitoring(url)
        if result:
            print(f"💡 Audio token: {result.get('token', 'N/A')}")
            print(f"   Download audio: curl \"{BASE_URL}/download?token={result.get('token', '')}\" -O\n")
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
    except Exception as e:
        print(f"\n❌ Fatal error: {e}")
