#!/bin/bash

npx playwright test --project=backend-teardown
sleep 3

lsof -i :3000
lsof -i :8000

npx playwright test --project=backend

sleep 1

response=$(curl -w "%{http_code}" -o /dev/null -s -X 'GET' 'http://localhost:8000/hello/testFromScript')
if [ "$response" -ne 200 ]; then
  echo "Backend is not available. HTTP status code: $response"
  # exit 1
else
  echo "Backend is available. HTTP status code: $response"
fi

lsof -i :3000
lsof -i :8000


