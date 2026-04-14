#!/bin/bash
# Start backend with reload, excluding model/inference directories
uvicorn main:app \
  --reload \
  --reload-dirs="." \
  --port 8000 \
  --env-file .env 2>&1
