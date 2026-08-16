#!/bin/bash

cd  ./infra

docker compose build
echo "Starting the containers..."

docker compose up -d
if [ $? -eq 0 ]; then
  echo "Containers started successfully."
else
  echo "Failed to start containers."
fi