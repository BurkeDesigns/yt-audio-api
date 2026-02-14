#!/bin/bash

# Quick Start Script for Chunked Transcription
# This script helps you test the new infinite length audio support

echo ""
echo "========================================"
echo "  YouTube Audio API - Chunked Processing"
echo "========================================"
echo ""
echo "This API now supports INFINITE LENGTH audio!"
echo ""

# Check if FFmpeg is installed
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg is not installed!"
    echo ""
    echo "Install it with:"
    echo "  brew install ffmpeg"
    echo ""
    exit 1
fi

echo "✅ FFmpeg is installed"
echo ""

# Check if Python packages are installed
echo "Checking Python environment..."
python3 -c "import flask, yt_dlp, parakeet_mlx" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  Some Python packages may be missing"
    echo ""
    echo "Install requirements with:"
    echo "  pip install -r requirements.txt"
    echo "  pip install parakeet-mlx"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Python environment ready"
echo ""

# Get YouTube URL
if [ -z "$1" ]; then
    echo "Enter YouTube URL to test:"
    read -r YOUTUBE_URL
else
    YOUTUBE_URL="$1"
fi

if [ -z "$YOUTUBE_URL" ]; then
    echo "❌ No URL provided"
    exit 1
fi

echo ""
echo "========================================"
echo "  Starting Test"
echo "========================================"
echo ""
echo "URL: $YOUTUBE_URL"
echo ""
echo "⚠️  Make sure the Flask server is running!"
echo "   (Run 'python main.py' in another terminal)"
echo ""

read -p "Press Enter to start test..." 

# Run the test
python3 test_chunked_transcription.py "$YOUTUBE_URL"

echo ""
echo "========================================"
echo "  Test Complete"
echo "========================================"
echo ""
echo "Check the Flask server terminal for detailed progress logs!"
echo ""
