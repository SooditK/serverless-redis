# Serverless Redis

HTTP server for Redis with Upstash compatibility.

## Technologies

- **Axum**: High-performance HTTP server framework for Rust
- **Redis**: Async Redis client with connection pooling
- **Docker**: Containerized deployment

## Why use this

- High performance with Rust and Axum
- Compatible with Upstash Redis HTTP API
- Easy deployment with Docker
- Bearer token authentication support

## Quick Start

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/8y27Xe?referralCode=uab9EQ&utm_medium=integration&utm_source=template&utm_campaign=generic)

### Using Docker Compose

```bash
docker-compose up
```

Server runs on `http://localhost:3000`

### Manual Setup

```bash
# Set environment variables
export REDIS_URL=redis://127.0.0.1:6379
export SR_TOKEN=your_token_here
export PORT=3000

# Build and run
cargo build --release
cargo run --release
```

## Environment Variables

- `REDIS_URL`: Redis connection URL (default: `redis://127.0.0.1:6379`)
- `SR_TOKEN`: Bearer token for authentication (optional)
- `PORT`: Server port (default: `3000`)

## Authentication

Include the token in the Authorization header:

```bash
curl -H "Authorization: Bearer your_token_here" http://localhost:3000/...
```

## API Compatibility

This server implements the Upstash Redis HTTP API, allowing you to use Upstash client libraries with your own Redis instance.

## License

MIT

