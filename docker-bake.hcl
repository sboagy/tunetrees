variable "platforms" {
  default = ["linux/amd64", "linux/arm64"]
}

group "all" {
  targets = [
    "server",
    "frontend"
  ]
}

target "server" {
  dockerfile = "Dockerfile"
  platforms = platforms
  tags = ["docker.io/sboagy/tunetrees-server:latest"]
  output = ["type=registry"]
}

target "frontend" {
  dockerfile = "Dockerfile"
  platforms = platforms
  tags = ["docker.io/sboagy/tunetrees-frontend:latest"]
  output = ["type=registry"]
}
