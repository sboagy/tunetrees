#!/bin/bash

npx playwright test --project=backend-teardown
sleep 3

lsof -i :3000
lsof -i :8000

npx playwright test --project=backend

sleep 1

curl -X 'GET' 'http://localhost:8000/hello/bozo' -w "%{http_code}" -H 'accept: application/json'

response=$(curl -w "%{http_code}" -o /dev/null -s -X 'GET' 'http://localhost:8000/hello/testFromScript')
if [ "$response" -ne 200 ]; then
  echo "Backend is not available. HTTP status code: $response"
  # exit 1
else
  echo "Backend is available. HTTP status code: $response"
fi

# curl -w "%{http_code}" -o /dev/null -s -X 'GET' 'http://localhost:8000/hello/foo'
# curl -w "%{http_code}" -o /dev/null -s -X 'GET' 'http://localhost:8000/hello/baz'
# curl -w "%{http_code}" -o /dev/null -s -X 'GET' 'http://127.0.0.1:8000/hello/yada'
# curl -w "%{http_code}" -o /dev/null -s -X 'GET' 'http://127.0.0.1:8000/hello/yodo'

lsof -i :3000
lsof -i :8000


