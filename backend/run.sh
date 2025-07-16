#!/bin/bash
echo "--- Starting application with infinite loop watchdog ---"

# Запускаем uvicorn в бесконечном цикле
while true; do
  echo "--- Launching Uvicorn process ---"
  uvicorn app:app --host 0.0.0.0 --port $PORT
  echo "--- Uvicorn process exited. Restarting in 5 seconds... ---"
  sleep 5
done
