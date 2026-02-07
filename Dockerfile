FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libnacl-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ARG GIT_SHA=
ENV GIT_SHA=${GIT_SHA}

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "bot.py"]
