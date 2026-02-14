# Handling Large Audio Files

This guide explains how to work with large audio files (1+ hours) in the YouTube Audio API with transcription.

## System Requirements

For transcribing large audio files, you'll need:

- **Memory**: At least 8GB RAM (16GB recommended for 2+ hour files)
- **Storage**: Enough space for downloaded audio (roughly 1MB per minute of audio)
- **Apple Silicon**: M1/M2/M3 Mac for optimal MLX performance
- **Python**: 3.10 or later

## File Size Limits

- **Hard limit**: 500 MB per audio file
- **Warning threshold**: 100 MB (transcription will work but take longer)
- **Recommended**: Files under 100 MB for faster processing

## Performance Expectations

Transcription speed varies based on:
- File size and duration
- Your Mac's chip (M1/M2/M3)
- System memory availability
- Other running processes

**Typical processing times** (on M1 Pro):
- 10-minute audio (~10 MB): 30-60 seconds
- 30-minute audio (~30 MB): 2-3 minutes  
- 1-hour audio (~60 MB): 4-6 minutes
- 1.5-hour audio (~90 MB): 6-10 minutes
- 2-hour audio (~120 MB): 8-15 minutes

## Using the Large File Script

For better monitoring and error handling with large files, use the dedicated script:

```bash
# Interactive mode
python transcribe_large_file.py

# Direct URL
python transcribe_large_file.py "https://www.youtube.com/watch?v=VIDEO_ID"
```

This script provides:
- ✅ Download progress and timing
- ✅ File size checking before transcription
- ✅ Estimated processing time
- ✅ Extended timeouts for large files
- ✅ Better error messages and recovery suggestions
- ✅ Performance metrics after completion

## Troubleshooting Large Files

### "Out of memory" error

**Symptoms**: Server crashes or returns 507 error

**Solutions**:
1. Close other applications to free memory
2. Split the audio into smaller segments
3. Use a Mac with more RAM
4. Restart the Flask server before processing

### Timeout errors

**Symptoms**: Request times out before completion (504 error)

**Solutions**:
1. Use `transcribe_large_file.py` which has longer timeouts
2. Process shorter audio segments
3. Ensure no other heavy processes are running

### Server crashes

**Symptoms**: Flask server exits with code 250 or crashes silently

**Solutions**:
1. Check available memory: `vm_stat | head -5`
2. Monitor server logs in terminal where Flask is running
3. Reduce file size limit in `main.py`:
   ```python
   MAX_FILE_SIZE_MB = 200  # Reduce from 500
   ```
4. Process files during times of low system activity

### Slow processing

**Symptoms**: Transcription takes much longer than expected

**Solutions**:
1. Ensure no other apps are using significant CPU
2. Check Activity Monitor for memory pressure
3. Close browser tabs and unnecessary applications
4. Restart your Mac if system has been running for days

## API Adjustments for Large Files

### Increase timeout in your client

```python
import requests

response = requests.get(
    "http://localhost:5001/transcribe",
    params={"token": token, "format": "json"},
    timeout=1800  # 30 minutes for very large files
)
```

### Check file size before transcription

```python
# Get file size from download endpoint
response = requests.head(
    "http://localhost:5001/download",
    params={"token": token}
)
file_size_mb = int(response.headers['Content-Length']) / (1024 * 1024)

if file_size_mb > 200:
    print(f"Warning: Large file ({file_size_mb:.1f}MB) - will take time")
```

### Process in batches

For very long content, consider:

1. Download the full audio with `/download` endpoint
2. Split the audio file using FFmpeg:
   ```bash
   # Split into 30-minute segments
   ffmpeg -i audio.mp3 -f segment -segment_time 1800 -c copy output%03d.mp3
   ```
3. Transcribe each segment separately
4. Combine the results

## Server Configuration

### Adjust limits in main.py

```python
# At the top of main.py
MAX_FILE_SIZE_MB = 300  # Lower if you have memory issues
LARGE_FILE_THRESHOLD_MB = 50  # Lower threshold for warnings
```

### Run with production server

For better stability with large files, use Gunicorn instead of Flask dev server:

```bash
# Install gunicorn
pip install gunicorn

# Run with more resources
gunicorn main:app \
    --bind 0.0.0.0:5001 \
    --workers 1 \
    --timeout 1800 \
    --max-requests 1000 \
    --max-requests-jitter 100
```

## Memory Management Tips

The server automatically:
- ✅ Checks file size before processing
- ✅ Warns about large files in console
- ✅ Runs garbage collection after large transcriptions
- ✅ Includes processing metrics in responses

You can also:
- Restart the server between large transcriptions
- Monitor memory with: `ps aux | grep python`
- Use Activity Monitor to watch memory usage

## Best Practices

1. **Test with short clips first**: Verify everything works with 5-10 minute videos
2. **Monitor the first large file**: Watch the Flask server terminal for warnings
3. **Don't queue multiple large files**: Process one at a time
4. **Save results immediately**: Store transcriptions as soon as received
5. **Keep server logs**: Redirect output to a file for debugging:
   ```bash
   python main.py 2>&1 | tee server.log
   ```

## Example Workflow

```bash
# Terminal 1: Start server with logging
python main.py 2>&1 | tee transcription.log

# Terminal 2: Process large file
python transcribe_large_file.py "https://www.youtube.com/watch?v=LONG_VIDEO"

# Watch progress in both terminals
# Results are saved automatically by the script
```

## Emergency Recovery

If the server becomes unresponsive:

```bash
# Find the process
ps aux | grep "python main.py"

# Kill it (replace PID with actual process ID)
kill -9 PID

# Restart fresh
python main.py
```

Downloaded audio files remain in `downloads/` directory and can be transcribed again using their tokens.

## Getting Help

If you continue to have issues with large files:

1. Check your system specs: Memory, CPU, available storage
2. Verify Python version: `python --version` (must be 3.10+)
3. Check parakeet-mlx version: `pip show parakeet-mlx`
4. Look at server logs for specific error messages
5. Try with a smaller file to isolate the issue

For 1.5+ hour files specifically:
- Expect 10-20 minute processing times
- Monitor system memory closely  
- Consider splitting into smaller segments if crashes persist
