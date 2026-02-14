"""
main.py
Developed by Alperen Sümeroğlu - YouTube Audio Converter API
Clean, modular Flask-based backend for downloading and serving YouTube audio tracks.
Utilizes yt-dlp and FFmpeg for conversion and token-based access management.
Extended with Parakeet-MLX for speech-to-text transcription.
"""

import secrets
import threading
import time
import gc
import subprocess
import shutil
import tempfile
from flask import Flask, request, jsonify, send_from_directory
from uuid import uuid4
from pathlib import Path
import yt_dlp
import access_manager
from constants import *
from parakeet_mlx import from_pretrained

# Configuration for chunked audio processing
# Now supports infinite length audio by processing in chunks!
CHUNK_DURATION_MINUTES = 10  # Process audio in 10-minute chunks (adjust based on memory)
CHUNK_DURATION_SECONDS = CHUNK_DURATION_MINUTES * 60
REMOVE_SILENCE = True  # Remove silence to reduce processing time and improve accuracy
MAX_FILE_SIZE_MB = None  # No limit! Chunks handle any size
LARGE_FILE_THRESHOLD_MB = 50  # Warn for files larger than this (per chunk)

# Initialize the Flask application
app = Flask(__name__)

# Configure Flask 
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 3600  # Cache control

# Initialize Parakeet model for transcription (lazy loading)
transcription_model = None

def get_transcription_model():
    """
    Lazy-loads the Parakeet transcription model.
    This ensures the model is only loaded when actually needed for transcription.
    """
    global transcription_model
    if transcription_model is None:
        print("🔄 Loading Parakeet transcription model (first time only)...")
        transcription_model = from_pretrained("mlx-community/parakeet-tdt-0.6b-v3")
        print("✓ Model loaded successfully")
    return transcription_model


def split_audio_into_chunks(audio_path, chunk_duration=CHUNK_DURATION_SECONDS, remove_silence=REMOVE_SILENCE):
    """
    Split audio file into manageable chunks with optional silence removal.
    
    Args:
        audio_path: Path to the audio file
        chunk_duration: Duration of each chunk in seconds
        remove_silence: Whether to remove silent parts
    
    Returns:
        List of tuples: [(chunk_path, start_time_offset), ...]
    """
    temp_dir = tempfile.mkdtemp(prefix="audio_chunks_")
    chunk_pattern = Path(temp_dir) / "chunk_%03d.mp3"
    chunks = []
    
    try:
        # Get audio duration first
        duration_cmd = [
            'ffprobe', '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            str(audio_path)
        ]
        result = subprocess.run(duration_cmd, capture_output=True, text=True, timeout=30)
        total_duration = float(result.stdout.strip())
        num_chunks = int((total_duration + chunk_duration - 1) / chunk_duration)
        
        print(f"📊 Audio duration: {total_duration/60:.1f} minutes")
        print(f"🔪 Splitting into {num_chunks} chunks of {chunk_duration/60:.1f} minutes each...")
        
        if remove_silence:
            print("🔇 Removing silence from audio...")
            # First, remove silence from the entire file
            temp_nosilence = Path(temp_dir) / "no_silence.mp3"
            silence_cmd = [
                'ffmpeg', '-i', str(audio_path),
                '-af', 'silenceremove=start_periods=1:start_duration=0.2:start_threshold=-50dB:detection=peak,'
                       'silenceremove=stop_periods=-1:stop_duration=0.5:stop_threshold=-50dB:detection=peak',
                '-y', str(temp_nosilence)
            ]
            subprocess.run(silence_cmd, capture_output=True, timeout=300)
            
            # Update audio path to the silence-removed version
            if temp_nosilence.exists() and temp_nosilence.stat().st_size > 0:
                audio_path = temp_nosilence
                # Recalculate duration
                result = subprocess.run(duration_cmd[:-1] + [str(audio_path)], 
                                       capture_output=True, text=True, timeout=30)
                total_duration = float(result.stdout.strip())
                num_chunks = int((total_duration + chunk_duration - 1) / chunk_duration)
                print(f"✓ Silence removed. New duration: {total_duration/60:.1f} minutes ({num_chunks} chunks)")
        
        # Split into chunks
        split_cmd = [
            'ffmpeg', '-i', str(audio_path),
            '-f', 'segment',
            '-segment_time', str(chunk_duration),
            '-c', 'copy',
            '-y', str(chunk_pattern)
        ]
        subprocess.run(split_cmd, capture_output=True, timeout=300)
        
        # Collect chunk files with their time offsets
        chunk_files = sorted(Path(temp_dir).glob("chunk_*.mp3"))
        for i, chunk_file in enumerate(chunk_files):
            start_offset = i * chunk_duration
            chunks.append((str(chunk_file), start_offset))
            chunk_size_mb = chunk_file.stat().st_size / (1024 * 1024)
            print(f"  ✓ Chunk {i+1}/{len(chunk_files)}: {chunk_file.name} ({chunk_size_mb:.1f}MB, offset: {start_offset/60:.1f}m)")
        
        return chunks, temp_dir
        
    except subprocess.TimeoutExpired:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise RuntimeError("FFmpeg operation timed out")
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise RuntimeError(f"Failed to split audio: {str(e)}")


@app.route("/", methods=["GET"])
def handle_audio_request():
    """
    Main endpoint to receive a YouTube video URL, download the audio in MP3 format,
    and return a unique token for accessing the file later.

    Query Parameters:
        - url (str): Full YouTube video URL.

    Returns:
        - JSON: {"token": <download_token>}
    """
    video_url = request.args.get("url")
    if not video_url:
        return jsonify(error="Missing 'url' parameter in request."), BAD_REQUEST

    filename_base = str(uuid4())
    output_path = Path(ABS_DOWNLOADS_PATH) / filename_base

    # yt-dlp configuration for downloading best audio and converting to mp3
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': str(output_path),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192'
        }],
        'quiet': True
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])
    except Exception as e:
        return jsonify(error="Failed to download or convert audio.", detail=str(e)), INTERNAL_SERVER_ERROR

    # yt-dlp adds .mp3 extension automatically, so we need to use that
    actual_filename = f"{filename_base}.mp3"
    return _generate_token_response(actual_filename)


@app.route("/download", methods=["GET"])
def download_audio():
    """
    Endpoint to serve an audio file associated with a given token.
    If token is valid and not expired, returns the associated MP3 file.

    Query Parameters:
        - token (str): Unique access token

    Returns:
        - MP3 audio file as attachment or error JSON
    """
    token = request.args.get("token")
    if not token:
        return jsonify(error="Missing 'token' parameter in request."), BAD_REQUEST

    if not access_manager.has_access(token):
        return jsonify(error="Token is invalid or unknown."), UNAUTHORIZED

    if not access_manager.is_valid(token):
        return jsonify(error="Token has expired."), REQUEST_TIMEOUT

    try:
        filename = access_manager.get_audio_file(token)
        return send_from_directory(ABS_DOWNLOADS_PATH, filename=filename, as_attachment=True)
    except FileNotFoundError:
        return jsonify(error="Requested file could not be found on the server."), NOT_FOUND


@app.route("/transcribe", methods=["GET"])
def transcribe_audio():
    """
    Endpoint to transcribe an audio file associated with a given token using Parakeet-MLX.
    Returns the full text transcription with optional timestamps.

    Query Parameters:
        - token (str): Unique access token
        - format (str, optional): Output format - 'text', 'json', 'srt', 'vtt' (default: 'text')
        - timestamps (bool, optional): Include timestamps in JSON format (default: false)

    Returns:
        - JSON with transcription: {"transcription": <text>} or detailed format based on 'format' parameter
    """
    token = request.args.get("token")
    if not token:
        return jsonify(error="Missing 'token' parameter in request."), BAD_REQUEST

    if not access_manager.has_access(token):
        return jsonify(error="Token is invalid or unknown."), UNAUTHORIZED

    if not access_manager.is_valid(token):
        return jsonify(error="Token has expired."), REQUEST_TIMEOUT

    try:
        filename = access_manager.get_audio_file(token)
        audio_path = Path(ABS_DOWNLOADS_PATH) / filename
        
        if not audio_path.exists():
            return jsonify(error="Audio file not found."), NOT_FOUND
        
        # Check initial file size
        file_size_mb = audio_path.stat().st_size / (1024 * 1024)
        print(f"📁 Audio file: {filename} ({file_size_mb:.1f}MB)")

        # Get transcription format preference
        output_format = request.args.get("format", "text").lower()
        
        # Load model once for all chunks
        print(f"🎤 Starting chunked transcription...")
        model = get_transcription_model()
        
        start_time = time.time()
        temp_dir = None
        
        try:
            # Split audio into chunks
            chunks, temp_dir = split_audio_into_chunks(audio_path)
            
            print(f"\n🔄 Processing {len(chunks)} chunks...")
            
            # Process each chunk
            all_sentences = []
            full_text_parts = []
            
            for i, (chunk_path, time_offset) in enumerate(chunks, 1):
                chunk_size_mb = Path(chunk_path).stat().st_size / (1024 * 1024)
                print(f"\n  [{i}/{len(chunks)}] Transcribing chunk ({chunk_size_mb:.1f}MB, offset: {time_offset/60:.1f}m)...")
                
                chunk_start = time.time()
                chunk_result = model.transcribe(chunk_path)
                chunk_elapsed = time.time() - chunk_start
                
                print(f"    ✓ Completed in {chunk_elapsed:.1f}s")
                
                # Adjust timestamps based on chunk offset
                for sentence in chunk_result.sentences:
                    adjusted_sentence = type('obj', (object,), {
                        'text': sentence.text,
                        'start': sentence.start + time_offset,
                        'end': sentence.end + time_offset,
                        'duration': sentence.duration
                    })()
                    all_sentences.append(adjusted_sentence)
                
                full_text_parts.append(chunk_result.text)
                
                # Clean up memory between chunks
                del chunk_result
                gc.collect()
            
            # Combine results
            full_text = " ".join(full_text_parts)
            elapsed_time = time.time() - start_time
            
            print(f"\n✓ All chunks transcribed in {elapsed_time:.1f}s")
            print(f"  Total sentences: {len(all_sentences)}")
            print(f"  Processing speed: {file_size_mb/elapsed_time:.2f}MB/s")
            
        finally:
            # Clean up temporary chunks
            if temp_dir and Path(temp_dir).exists():
                shutil.rmtree(temp_dir, ignore_errors=True)
                print("  ✓ Cleaned up temporary chunks")

        
        # Format response based on requested format
        if output_format == "json" or request.args.get("timestamps", "").lower() == "true":
            response_data = {
                "transcription": full_text,
                "sentences": [
                    {
                        "text": sentence.text,
                        "start": sentence.start,
                        "end": sentence.end,
                        "duration": sentence.duration
                    }
                    for sentence in all_sentences
                ],
                "metadata": {
                    "file_size_mb": round(file_size_mb, 2),
                    "processing_time_seconds": round(elapsed_time, 2),
                    "processing_speed_mb_per_sec": round(file_size_mb/elapsed_time, 2),
                    "chunks_processed": len(chunks),
                    "silence_removed": REMOVE_SILENCE
                }
            }
            return jsonify(response_data)
        elif output_format == "srt":
            # Generate SRT format
            srt_content = _generate_srt(all_sentences)
            return srt_content, 200, {'Content-Type': 'text/plain; charset=utf-8'}
        elif output_format == "vtt":
            # Generate VTT format
            vtt_content = _generate_vtt(all_sentences)
            return vtt_content, 200, {'Content-Type': 'text/vtt; charset=utf-8'}
        else:
            # Return plain text
            return jsonify({"transcription": full_text})
            
    except MemoryError:
        return jsonify(error="Out of memory. The audio file may be too large for transcription.", 
                      suggestion="Try reducing CHUNK_DURATION_MINUTES or enable silence removal."), 507
    except TimeoutError:
        return jsonify(error="Transcription timeout. The audio file is taking too long to process.",
                      suggestion="Try a shorter audio clip."), 504
    except Exception as e:
        error_msg = str(e)
        print(f"❌ Transcription error: {error_msg}")
        return jsonify(error="Transcription failed.", detail=error_msg), INTERNAL_SERVER_ERROR


def _generate_srt(sentences):
    """Generate SRT subtitle format from sentences."""
    srt_lines = []
    for i, sentence in enumerate(sentences, 1):
        start = _format_timestamp_srt(sentence.start)
        end = _format_timestamp_srt(sentence.end)
        srt_lines.append(f"{i}\n{start} --> {end}\n{sentence.text.strip()}\n")
    return "\n".join(srt_lines)


def _generate_vtt(sentences):
    """Generate WebVTT subtitle format from sentences."""
    vtt_lines = ["WEBVTT\n"]
    for sentence in sentences:
        start = _format_timestamp_vtt(sentence.start)
        end = _format_timestamp_vtt(sentence.end)
        vtt_lines.append(f"{start} --> {end}\n{sentence.text.strip()}\n")
    return "\n".join(vtt_lines)


def _format_timestamp_srt(seconds):
    """Format seconds to SRT timestamp (HH:MM:SS,mmm)."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def _format_timestamp_vtt(seconds):
    """Format seconds to WebVTT timestamp (HH:MM:SS.mmm)."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds % 1) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def _generate_token_response(filename: str):
    """
    Generates a secure download token for a given filename,
    registers it in the access manager, and returns the token as JSON.

    Args:
        filename (str): The name of the downloaded MP3 file

    Returns:
        JSON: {"token": <generated_token>}
    """
    token = secrets.token_urlsafe(TOKEN_LENGTH)
    access_manager.add_token(token, filename)
    return jsonify(token=token)


def main():
    """
    Starts the background thread for automatic token cleanup
    and launches the Flask development server.
    """
    token_cleaner_thread = threading.Thread(
        target=access_manager.manage_tokens,
        daemon=True
    )
    token_cleaner_thread.start()
    app.run(debug=True, port=5001)


if __name__ == "__main__":
    main()
