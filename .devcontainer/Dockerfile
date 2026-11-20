FROM mcr.microsoft.com/devcontainers/python:1-3.11-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl unzip zip git jq xvfb libgl1 libxi6 libxrender1 libxrandr2 libxcursor1 libxinerama1 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /workspaces/FORGE-OS
