#!/usr/bin/env bash
# Linux CI diagnostics: never include process arguments, environments, or HTTP bodies.
set -u
diagnostics_dir="${CI_DIAGNOSTICS_DIR:-ci-diagnostics}"
mkdir -p "$diagnostics_dir"

snapshot() {
  date -u '+%Y-%m-%dT%H:%M:%SZ'
  free -m
  ps -eo pid,ppid,comm,rss,pcpu --sort=-rss | head -31
  timeout 5 docker stats --no-stream --format '{{.Name}} memory={{.MemUsage}} cpu={{.CPUPerc}}' || true
  curl --silent --show-error --max-time 3 --output /dev/null \
    --write-out 'worker_health status=%{http_code} seconds=%{time_total}\n' \
    http://localhost:8787/health || true
}

if [[ "${1:-}" == "--final" ]]; then
  snapshot >> "$diagnostics_dir/final.log" 2>&1
  # Select only lifecycle fields; full docker inspect includes credentials.
  for container_id in $(timeout 5 docker ps -aq); do
    timeout 5 docker inspect --format \
      '{{.Name}} status={{.State.Status}} exit={{.State.ExitCode}} oom={{.State.OOMKilled}} finished={{.State.FinishedAt}}' \
      "$container_id" >> "$diagnostics_dir/containers.log" 2>&1 || true
  done
  # Hosted runners may restrict kernel access. Preserve that error if unavailable.
  timeout 5 sudo -n dmesg --ctime 2>&1 | \
    awk 'BEGIN { IGNORECASE=1 } /oom|out of memory|killed process|cannot|permission|not permitted/' \
    > "$diagnostics_dir/kernel-oom.log"
  exit 0
fi

trap 'exit 0' TERM INT
# Sample throughout the tests: end-of-job memory cannot explain an earlier crash.
while true; do
  snapshot >> "$diagnostics_dir/resources.log" 2>&1
  sleep 15 &
  wait $! || true
done
