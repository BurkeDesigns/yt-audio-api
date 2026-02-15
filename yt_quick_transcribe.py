#!/usr/bin/env python3
"""
YouTube Quick Transcribe - Standalone Script

Fast YouTube audio transcription without needing the API server.
Supports infinite length audio through chunking with silence removal.

Usage:
    python yt_quick_transcribe.py "YOUTUBE_URL_OR_VIDEO_ID" "output.json"
    
Example:
    python yt_quick_transcribe.py "dQw4w9WgXcQ" "transcript.json"
    python yt_quick_transcribe.py "https://www.youtube.com/watch?v=dQw4w9WgXcQ" "transcript.json"
"""

import sys
import json
import time
import tempfile
import subprocess
import shutil
import re
from pathlib import Path
from typing import Tuple, List, Optional

try:
    import yt_dlp
    from parakeet_mlx import from_pretrained
except ImportError as e:
    print(f"❌ Error: Required package not installed: {e}")
    print("\nInstall with:")
    print("  pip install yt-dlp parakeet-mlx")
    sys.exit(1)


# Configuration
CHUNK_DURATION_MINUTES = 10
CHUNK_DURATION_SECONDS = CHUNK_DURATION_MINUTES * 60
REMOVE_SILENCE = True


def extract_video_id(url_or_id: str) -> str:
    """Extract YouTube video ID from URL or return ID if already provided."""
    # If it's already just an ID (11 characters, alphanumeric with dashes/underscores)
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url_or_id):
        return url_or_id
    
    # Try to extract from various YouTube URL formats
    patterns = [
        r'(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]{11})',
        r'youtube\.com/embed/([a-zA-Z0-9_-]{11})',
        r'youtube\.com/v/([a-zA-Z0-9_-]{11})',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            return match.group(1)
    
    # If no pattern matched, assume it's an ID
    return url_or_id


def download_audio(video_id: str, output_dir: Path) -> Tuple[Path, float, float]:
    """
    Download audio from YouTube.
    
    Returns:
        Tuple of (audio_path, download_time, duration_seconds)
    """
    print(f"📥 Downloading audio for video: {video_id}")
    
    output_path = output_dir / video_id
    start_time = time.time()
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': f"{output_path}.%(ext)s",
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192'
        }],
        'quiet': True,
        'no_warnings': True
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=True)
            duration = info.get('duration', 0)
        
        download_time = time.time() - start_time
        audio_path = output_dir / f"{video_id}.mp3"
        
        if not audio_path.exists():
            raise FileNotFoundError(f"Downloaded audio file not found: {audio_path}")
        
        file_size_mb = audio_path.stat().st_size / (1024 * 1024)
        print(f"✓ Downloaded {file_size_mb:.1f}MB in {download_time:.1f}s")
        print(f"  Duration: {duration/60:.1f} minutes")
        
        return audio_path, download_time, duration
        
    except Exception as e:
        raise RuntimeError(f"Failed to download audio: {e}")


def get_audio_duration(audio_path: Path) -> float:
    """Get audio duration in seconds using ffprobe."""
    try:
        cmd = [
            'ffprobe', '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            str(audio_path)
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        return float(result.stdout.strip())
    except Exception as e:
        print(f"⚠️  Could not get audio duration: {e}")
        return 0.0


def split_and_remove_silence(audio_path: Path, chunk_duration: int = CHUNK_DURATION_SECONDS) -> List[Tuple[Path, float]]:
    """
    Split audio into chunks and remove silence.
    
    Returns:
        List of (chunk_path, time_offset) tuples
    """
    temp_dir = Path(tempfile.mkdtemp(prefix="audio_chunks_"))
    chunks = []
    
    try:
        duration = get_audio_duration(audio_path)
        
        # If audio is shorter than chunk duration, just process it directly
        if duration <= chunk_duration:
            print(f"📊 Audio is {duration/60:.1f} minutes (no chunking needed)")
            
            if REMOVE_SILENCE:
                print("🔇 Removing silence...")
                no_silence_path = temp_dir / "no_silence.mp3"
                silence_cmd = [
                    'ffmpeg', '-i', str(audio_path),
                    '-af', 'silenceremove=start_periods=1:start_duration=0.2:start_threshold=-50dB:detection=peak,'
                           'silenceremove=stop_periods=-1:stop_duration=0.5:stop_threshold=-50dB:detection=peak',
                    '-y', str(no_silence_path)
                ]
                subprocess.run(silence_cmd, capture_output=True, timeout=300, check=True)
                
                if no_silence_path.exists() and no_silence_path.stat().st_size > 0:
                    new_duration = get_audio_duration(no_silence_path)
                    reduction = ((duration - new_duration) / duration * 100) if duration > 0 else 0
                    print(f"✓ Silence removed: {duration/60:.1f}m → {new_duration/60:.1f}m ({reduction:.0f}% reduction)")
                    chunks.append((no_silence_path, 0.0))
                else:
                    chunks.append((audio_path, 0.0))
            else:
                chunks.append((audio_path, 0.0))
            
            return chunks
        
        # Audio is long, need to chunk
        num_chunks = int((duration + chunk_duration - 1) / chunk_duration)
        print(f"📊 Audio duration: {duration/60:.1f} minutes")
        print(f"🔪 Splitting into {num_chunks} chunks of {chunk_duration/60:.1f} minutes each...")
        
        # Remove silence first if enabled
        process_path = audio_path
        if REMOVE_SILENCE:
            print("🔇 Removing silence from full audio...")
            no_silence_path = temp_dir / "no_silence.mp3"
            silence_cmd = [
                'ffmpeg', '-i', str(audio_path),
                '-af', 'silenceremove=start_periods=1:start_duration=0.2:start_threshold=-50dB:detection=peak,'
                       'silenceremove=stop_periods=-1:stop_duration=0.5:stop_threshold=-50dB:detection=peak',
                '-y', str(no_silence_path)
            ]
            subprocess.run(silence_cmd, capture_output=True, timeout=600, check=True)
            
            if no_silence_path.exists() and no_silence_path.stat().st_size > 0:
                new_duration = get_audio_duration(no_silence_path)
                reduction = ((duration - new_duration) / duration * 100) if duration > 0 else 0
                print(f"✓ Silence removed: {duration/60:.1f}m → {new_duration/60:.1f}m ({reduction:.0f}% reduction)")
                process_path = no_silence_path
                duration = new_duration
                num_chunks = int((duration + chunk_duration - 1) / chunk_duration)
        
        # Split into chunks
        print(f"🔪 Splitting into {num_chunks} chunks...")
        chunk_pattern = temp_dir / "chunk_%03d.mp3"
        split_cmd = [
            'ffmpeg', '-i', str(process_path),
            '-f', 'segment',
            '-segment_time', str(chunk_duration),
            '-c', 'copy',
            '-y', str(chunk_pattern)
        ]
        subprocess.run(split_cmd, capture_output=True, timeout=600, check=True)
        
        # Collect chunks
        chunk_files = sorted(temp_dir.glob("chunk_*.mp3"))
        for i, chunk_file in enumerate(chunk_files):
            time_offset = i * chunk_duration
            chunk_size_mb = chunk_file.stat().st_size / (1024 * 1024)
            print(f"  ✓ Chunk {i+1}/{len(chunk_files)}: {chunk_size_mb:.1f}MB, offset: {time_offset/60:.1f}m")
            chunks.append((chunk_file, time_offset))
        
        return chunks
        
    except subprocess.TimeoutExpired:
        raise RuntimeError("Audio processing timed out")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFmpeg error: {e}")
    except Exception as e:
        raise RuntimeError(f"Failed to process audio: {e}")


def transcribe_chunks(chunks: List[Tuple[Path, float]], model) -> str:
    """
    Transcribe all chunks and combine into full transcript.
    
    Returns:
        Full transcript text (no timestamps)
    """
    print(f"\n🎤 Transcribing {len(chunks)} chunk(s)...")
    
    full_text_parts = []
    
    for i, (chunk_path, time_offset) in enumerate(chunks, 1):
        chunk_size_mb = chunk_path.stat().st_size / (1024 * 1024)
        print(f"  [{i}/{len(chunks)}] Processing {chunk_size_mb:.1f}MB...")
        
        chunk_start = time.time()
        result = model.transcribe(str(chunk_path))
        chunk_elapsed = time.time() - chunk_start
        
        print(f"    ✓ Completed in {chunk_elapsed:.1f}s")
        
        full_text_parts.append(result.text.strip())
        
        # Clean up memory
        del result
    
    # Combine all text parts
    full_transcript = " ".join(full_text_parts)
    
    return full_transcript


def main():
    """Main entry point."""
    if len(sys.argv) < 3:
        print("Usage: python yt_quick_transcribe.py <YOUTUBE_URL_OR_VIDEO_ID> <OUTPUT_JSON_PATH>")
        print("\nExample:")
        print("  python yt_quick_transcribe.py dQw4w9WgXcQ transcript.json")
        print("  python yt_quick_transcribe.py 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' transcript.json")
        sys.exit(1)
    
    url_or_id = sys.argv[1]
    output_path = Path(sys.argv[2])
    
    # Extract video ID
    video_id = extract_video_id(url_or_id)
    print(f"\n{'='*70}")
    print(f"🎬 YouTube Quick Transcribe")
    print(f"{'='*70}")
    print(f"Video ID: {video_id}")
    print(f"Output: {output_path}")
    print(f"{'='*70}\n")
    
    # Check if output already exists
    if output_path.exists():
        print(f"✅ Transcript already exists: {output_path}")
        print(f"\n📄 Contents:\n")
        with open(output_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            print(json.dumps(data, indent=2, ensure_ascii=False))
        print(f"\n💡 Delete {output_path} to regenerate")
        return
    
    # Create temporary directory for all work
    temp_dir = Path(tempfile.mkdtemp(prefix="yt_transcribe_"))
    
    try:
        total_start = time.time()
        
        # Download audio
        audio_path, download_time, audio_duration = download_audio(video_id, temp_dir)
        
        # Split and remove silence if needed
        transcribe_start = time.time()
        chunks = split_and_remove_silence(audio_path, CHUNK_DURATION_SECONDS)
        
        # Load model once
        print("\n🔄 Loading transcription model...")
        model_load_start = time.time()
        model = from_pretrained("mlx-community/parakeet-tdt-0.6b-v3")
        model_load_time = time.time() - model_load_start
        print(f"✓ Model loaded in {model_load_time:.1f}s")
        
        # Transcribe all chunks
        full_transcript = transcribe_chunks(chunks, model)
        transcription_time = time.time() - transcribe_start
        
        total_time = time.time() - total_start
        
        # Create output JSON
        output_data = {
            "video_id": video_id,
            "transcript": full_transcript,
            "metadata": {
                "audio_download_time": round(download_time, 2),
                "audio_duration": round(audio_duration, 2),
                "transcription_time": round(transcription_time, 2),
                "total_time": round(total_time, 2),
                "chunks_processed": len(chunks),
                "silence_removed": REMOVE_SILENCE
            }
        }
        
        # Save to file
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2, ensure_ascii=False)
        
        # Print results
        print(f"\n{'='*70}")
        print("✅ Transcription Complete!")
        print(f"{'='*70}")
        print(f"📊 Statistics:")
        print(f"   Audio duration:      {audio_duration/60:.1f} minutes")
        print(f"   Download time:       {download_time:.1f}s")
        print(f"   Transcription time:  {transcription_time:.1f}s")
        print(f"   Total time:          {total_time:.1f}s")
        print(f"   Chunks processed:    {len(chunks)}")
        print(f"   Transcript length:   {len(full_transcript)} characters")
        print(f"\n💾 Saved to: {output_path.absolute()}")
        print(f"{'='*70}\n")
        
        # Print preview
        print("📝 Transcript Preview (first 500 characters):\n")
        print(full_transcript[:500])
        if len(full_transcript) > 500:
            print("...\n")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        # Clean up temp directory
        if temp_dir.exists():
            print(f"\n🧹 Cleaning up temporary files...")
            shutil.rmtree(temp_dir, ignore_errors=True)
            print("✓ Cleanup complete")


if __name__ == "__main__":
    main()
