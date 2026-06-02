#!/bin/bash
set -e

# Install system dependencies
sudo apt-get update
sudo apt-get install -y ffmpeg libnacl-dev

# Install project dependencies
npm ci
