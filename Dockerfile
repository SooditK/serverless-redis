FROM rust:1.91-slim AS chef
WORKDIR /app
RUN cargo install cargo-chef

FROM chef AS planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM chef AS builder
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json
COPY . .
RUN cargo build --release --bin serverless-redis

FROM gcr.io/distroless/cc-debian12:nonroot
COPY --from=builder /app/target/release/serverless-redis /usr/local/bin/serverless-redis
USER nonroot:nonroot

CMD ["/usr/local/bin/serverless-redis"]