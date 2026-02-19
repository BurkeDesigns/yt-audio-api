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
    import torch
    import nemo.collections.asr as nemo_asr
    from nemo.collections.asr.parts.utils.rnnt_utils import Hypothesis
except ImportError as e:
    print(f"❌ Error: Required package not installed: {e}")
    print("\nInstall with:")
    print("  pip install yt-dlp nemo_toolkit[asr] torch")
    sys.exit(1)


# Configuration
CHUNK_TARGET_SEC = 10 * 60         # 10 minutes
WINDOW_SEC  = 30                    # look +/- 30s around each 10m mark for nearest silence
NOISE_DB    = -38                   # silencedetect noise threshold
MIN_SIL_D   = 0.7                   # minimum silence duration (seconds)
ASR_SR      = 16000                 # re-encode chunks to 16k mono WAV
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
            'preferredcodec': 'wav',
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
        audio_path = output_dir / f"{video_id}.wav"
        
        if not audio_path.exists():
            raise FileNotFoundError(f"Downloaded audio file not found: {audio_path}")
        
        file_size_mb = audio_path.stat().st_size / (1024 * 1024)
        print(f"✓ Downloaded {file_size_mb:.1f}MB in {download_time:.1f}s")
        print(f"  Duration: {duration/60:.1f} minutes")
        
        return audio_path, download_time, duration
        
    except Exception as e:
        raise RuntimeError(f"Failed to download audio: {e}")


def ffprobe_duration_seconds(path: str) -> float:
    """Return duration in seconds via ffprobe."""
    try:
        cmd = [
            "ffprobe", "-v", "error", "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path)
        ]
        out = subprocess.check_output(cmd, text=True).strip()
        return float(out)
    except Exception as e:
        print(f"⚠️  Could not get audio duration for {path}: {e}")
        return 0.0


def get_audio_properties(path: str) -> Tuple[int, int]:
    """Return (sample_rate, channels) via ffprobe."""
    try:
        cmd = [
            "ffprobe", "-v", "error", "-show_entries", "stream=sample_rate,channels",
            "-of", "default=noprint_wrappers=1:nokey=1", str(path)
        ]
        out = subprocess.check_output(cmd, text=True).strip()
        lines = out.splitlines()
        sample_rate = int(lines[0])
        channels = int(lines[1])
        return sample_rate, channels
    except Exception as e:
        print(f"⚠️  Could not get audio properties for {path}: {e}")
        return 0, 0


def detect_silences(path: str, noise_db: int = NOISE_DB, min_sil_d: float = MIN_SIL_D) -> List[Tuple[float, float]]:
    """
    Use ffmpeg silencedetect to get a list of (silence_start, silence_end) in seconds.
    """
    print(f"🔇 Detecting silence (threshold: {noise_db}dB)...")
    cmd = [
        "ffmpeg", "-i", str(path),
        "-af", f"silencedetect=noise={noise_db}dB:d={min_sil_d}",
        "-f", "null", "-"
    ]
    proc = subprocess.Popen(cmd, stderr=subprocess.PIPE, stdout=subprocess.DEVNULL, text=True)
    stderr = proc.communicate()[1]
    
    sil_starts = []
    sil_ends = []
    for line in stderr.splitlines():
        m1 = re.search(r"silence_start:\s*([0-9.]+)", line)
        m2 = re.search(r"silence_end:\s*([0-9.]+)", line)
        if m1:
            sil_starts.append(float(m1.group(1)))
        if m2:
            sil_ends.append(float(m2.group(1)))

    pairs: List[Tuple[float, float]] = []
    si = ei = 0
    while si < len(sil_starts) and ei < len(sil_ends):
        if sil_starts[si] < sil_ends[ei]:
            pairs.append((sil_starts[si], sil_ends[ei]))
            si += 1
            ei += 1
        else:
            ei += 1
    
    print(f"✓ Detected {len(pairs)} silence intervals")
    return pairs


def choose_boundaries(duration: float,
                      silence_pairs: List[Tuple[float,float]],
                      target_sec: float = CHUNK_TARGET_SEC,
                      window_sec: float = WINDOW_SEC) -> List[float]:
    """
    Pick nearest silence midpoints for boundaries.
    """
    mids = [0.5*(s+e) for (s,e) in silence_pairs]
    boundaries: List[float] = []
    n_marks = int(duration // target_sec)

    for k in range(1, n_marks+1):
        mark = k * target_sec
        best_t = None
        best_dist = float("inf")
        for m in mids:
            dist = abs(m - mark)
            if dist <= window_sec and dist < best_dist:
                best_dist = dist
                best_t = m
        if best_t is None:
            best_t = mark  # fallback
        if 1.0 <= best_t <= (duration - 1.0):
            boundaries.append(best_t)

    boundaries = sorted({round(b, 3) for b in boundaries})
    return boundaries


def ffmpeg_export_chunk(src: str, start: float, end: float, out_wav: str, ar: int = ASR_SR):
    """Export segment to mono WAV for ASR."""
    dur = max(0.0, end - start)
    cmd = [
        "ffmpeg", "-y",
        "-ss", f"{start:.3f}",
        "-i", str(src),
        "-t", f"{dur:.3f}",
        "-ac", "1",
        "-ar", str(ar),
        "-vn",
        "-c:a", "pcm_s16le",
        str(out_wav)
    ]
    subprocess.run(cmd, capture_output=True, check=True)


def split_into_chunks(audio_path: Path, temp_dir: Path) -> List[Tuple[Path, float]]:
    """Split audio into chunks using silence-aware boundaries."""
    try:
        duration = ffprobe_duration_seconds(audio_path)
        
        if duration <= CHUNK_TARGET_SEC:
            print(f"📊 Audio is {duration/60:.1f} minutes (no chunking needed)")
            # Still convert to 16k mono WAV as NeMo prefers it
            wav_path = temp_dir / "full_audio.wav"
            ffmpeg_export_chunk(audio_path, 0, duration, wav_path)
            return [(wav_path, 0.0)]

        print(f"📊 Audio duration: {duration/60:.1f} minutes")
        
        sil = detect_silences(audio_path)
        boundaries = choose_boundaries(duration, sil)
        print(f"🔪 Chosen {len(boundaries)} cut points near each {CHUNK_TARGET_SEC/60:.0f}-min mark")
        
        cuts = [0.0] + boundaries + [duration]
        chunks = []
        
        print(f"🔪 Exporting {len(cuts)-1} chunks...")
        for i in range(len(cuts)-1):
            start = cuts[i]
            end = cuts[i+1]
            out_path = temp_dir / f"chunk_{i+1:03d}_{start:.1f}-{end:.1f}.wav"
            ffmpeg_export_chunk(audio_path, start, end, out_path)
            chunks.append((out_path, start))
            
            chunk_size_mb = out_path.stat().st_size / (1024 * 1024)
            print(f"  ✓ Chunk {i+1}/{len(cuts)-1}: {chunk_size_mb:.1f}MB, offset: {start/60:.1f}m")
            
        return chunks
        
    except subprocess.TimeoutExpired:
        raise RuntimeError("Audio processing timed out")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"FFmpeg error: {e}")
    except Exception as e:
        raise RuntimeError(f"Failed to process audio: {e}")


def transcribe_chunks(chunks: List[Tuple[Path, float]]) -> str:
    """
    Transcribe all chunks using NeMo Parakeet and combine.
    """
    print("\n🔄 Loading NeMo ASR model...")
    model_load_start = time.time()
    
    # Load model
    asr_model = nemo_asr.models.ASRModel.from_pretrained(model_name="nvidia/parakeet-tdt-0.6b-v3")
    
    # CUDA check
    device = "cuda" if torch.cuda.is_available() else "cpu"
    asr_model = asr_model.to(device)
    
    # Long-form attention tweak from reference
    asr_model.change_attention_model(self_attention_model="rel_pos_local_attn", att_context_size=[256, 256])
    
    model_load_time = time.time() - model_load_start
    print(f"✓ Model loaded in {model_load_time:.1f}s on {device.upper()}")

    print(f"\n🎤 Transcribing {len(chunks)} chunk(s)...")
    
    full_text_parts = []
    
    for i, (chunk_path, time_offset) in enumerate(chunks, 1):
        chunk_size_mb = chunk_path.stat().st_size / (1024 * 1024)
        print(f"  [{i}/{len(chunks)}] Processing {chunk_size_mb:.1f}MB...")
        
        chunk_start = time.time()
        
        # NeMo transcribe returns a list of strings (or Hypothesis objects depending on version)
        out = asr_model.transcribe([str(chunk_path)])
        
        if isinstance(out, list):
            if len(out) > 0 and isinstance(out[0], Hypothesis):
                txt = out[0].text
            elif len(out) > 0:
                txt = str(out[0])
            else:
                txt = ""
        else:
            txt = str(out)
            
        chunk_elapsed = time.time() - chunk_start
        print(f"    ✓ Completed in {chunk_elapsed:.1f}s")
        
        full_text_parts.append(txt.strip())
        
        # Optional: memory cleanup
        if device == "cuda":
            torch.cuda.empty_cache()
    
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
        
        # Split into chunks (silence-aware)
        transcribe_start = time.time()
        chunks = split_into_chunks(audio_path, temp_dir)
        
        # Transcribe all chunks
        full_transcript = transcribe_chunks(chunks)
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
                "silence_removed": REMOVE_SILENCE,
                "model": "nvidia/parakeet-tdt-0.6b-v3",
                "device": "cuda" if torch.cuda.is_available() else "cpu"
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
