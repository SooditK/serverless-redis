# Serverless Redis

HTTP server for Redis with Upstash compatibility.

## Technologies

- **Axum**: High-performance HTTP server framework for Rust
- **Redis**: Async Redis client with connection pooling
- **Docker**: Containerized deployment

## Why use this

- High performance with Rust and Axum
- Compatible with Upstash Redis HTTP API
- Pub/Sub support with Server-Sent Events (SSE)
- Easy deployment with Docker
- Bearer token authentication support

## Quick Start

### Using Docker Compose

```bash
docker-compose up
```

Server runs on `http://localhost:3000`

### Manual Setup

#### Option 1: Using .env file (recommended)

Create a `.env` file in the project root:

```bash
REDIS_URL=redis://127.0.0.1:6379
SR_TOKEN=your_token_here
PORT=3000
```

Then run:

```bash
cargo run
```

#### Option 2: Using environment variables

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

### Supported Features

- All standard Redis commands (strings, lists, sets, hashes, etc.)
- Pub/Sub with `SUBSCRIBE` and `PSUBSCRIBE` via SSE
- Pipeline and multi-exec support

## License

MIT

