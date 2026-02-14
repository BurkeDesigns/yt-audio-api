# Parakeet-MLX Transcription Setup Guide

This project now includes **AI-powered speech-to-text transcription** capabilities using [Parakeet-MLX](https://github.com/senstella/parakeet-mlx), an implementation of NVIDIA's Parakeet ASR models optimized for Apple Silicon.

## Prerequisites

1. **Apple Silicon Mac** (M1, M2, M3, etc.) - Parakeet-MLX is optimized for Apple Silicon using MLX
2. **FFmpeg** - Already required for audio conversion
3. **Python 3.8+**

## Installation Methods

### Method 1: Using uv (Recommended)

[uv](https://docs.astral.sh/uv/) is a fast Python package manager. This is the recommended installation method by the Parakeet-MLX team.

```bash
# Install uv if you don't have it
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install parakeet-mlx
uv pip install parakeet-mlx -U
```

### Method 2: Using pip

```bash
pip3 install parakeet-mlx -U
```

### Method 3: Direct from GitHub (Development)

If the package isn't available on PyPI yet:

```bash
pip3 install git+https://github.com/senstella/parakeet-mlx.git
```

## Verifying Installation

```python
from parakeet_mlx import from_pretrained

# This will download the model on first run
model = from_pretrained("mlx-community/parakeet-tdt-0.6b-v3")
print("✓ Parakeet-MLX installed successfully!")
```

## First-Time Model Download

The first time you use the transcription endpoint, Parakeet will automatically download the AI model (~600MB) from Hugging Face. This is a one-time download and will be cached locally.

## New API Endpoint

### `/transcribe` - AI Transcription

Transcribe audio files with optional timestamps and multiple output formats.

**Parameters:**
- `token` (required) - The access token from the download endpoint
- `format` (optional) - Output format: `text`, `json`, `srt`, `vtt` (default: `text`)
- `timestamps` (optional) - Include timestamps when using JSON format (default: `false`)

**Examples:**

```bash
# Get plain text transcription
curl "http://localhost:5001/transcribe?token=YOUR_TOKEN"

# Get JSON with timestamps
curl "http://localhost:5001/transcribe?token=YOUR_TOKEN&format=json"

# Get SRT subtitles
curl "http://localhost:5001/transcribe?token=YOUR_TOKEN&format=srt"

# Get WebVTT subtitles
curl "http://localhost:5001/transcribe?token=YOUR_TOKEN&format=vtt"
```

**Response Examples:**

*Plain Text (default):*
```json
{
  "transcription": "This is the transcribed text from the audio."
}
```

*JSON with timestamps:*
```json
{
  "transcription": "This is the transcribed text from the audio.",
  "sentences": [
    {
      "text": "This is the transcribed text from the audio.",
      "start": 0.5,
      "end": 3.2,
      "duration": 2.7
    }
  ]
}
```

*SRT format:*
```
1
00:00:00,500 --> 00:00:03,200
This is the transcribed text from the audio.
```

*WebVTT format:*
```
WEBVTT

00:00:00.500 --> 00:00:03.200
This is the transcribed text from the audio.
```

## Full Workflow Example

```bash
# 1. Get a video URL and request a token
curl "http://localhost:5001/?url=https://www.youtube.com/watch?v=VIDEO_ID"
# Response: {"token": "abc123..."}

# 2. Download the audio file (optional)
curl "http://localhost:5001/download?token=abc123..." -O

# 3. Get transcription
curl "http://localhost:5001/transcribe?token=abc123...&format=json"
```

## Features

- 🎯 **High Accuracy** - Uses NVIDIA's state-of-the-art Parakeet models
- ⚡ **Apple Silicon Optimized** - Leverages MLX for fast inference on M1/M2/M3 chips
- ⏱️ **Precise Timestamps** - Sentence and word-level timing information
- 📝 **Multiple Formats** - Plain text, JSON, SRT, WebVTT
- 🔄 **Automatic Model Management** - Models are downloaded and cached automatically

## Troubleshooting

### Import Error

If you get an import error for `parakeet_mlx`, ensure it's properly installed:

```bash
python3 -c "import parakeet_mlx; print('✓ Installed')"
```

### Model Download Issues

The model downloads from Hugging Face on first use. If you have network issues:

1. Check your internet connection
2. Verify Hugging Face is accessible
3. The model cache is stored in `~/.cache/huggingface/`

### Memory Issues

The model requires approximately 2GB of RAM. If you encounter memory issues:

- Close other applications
- Restart the Flask server
- Consider using a machine with more RAM

## Technical Details

- **Model**: `mlx-community/parakeet-tdt-0.6b-v3` (600MB)
- **Framework**: MLX (Apple's ML framework)
- **ASR Type**: TDT (Token-and-Duration Transducer)
- **Supported Audio**: Any format supported by FFmpeg (MP3, WAV, M4A, etc.)

## Credits

- [Parakeet-MLX](https://github.com/senstella/parakeet-mlx) by senstella
- [NVIDIA Parakeet Models](https://www.nvidia.com/)
- [MLX Framework](https://github.com/ml-explore/mlx) by Apple

## License

Parakeet-MLX is licensed under Apache 2.0
