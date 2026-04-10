FROM golang:1.25-alpine AS builder

WORKDIR /app

# git required for go mod to fetch from VCS
RUN apk add --no-cache git

COPY go.mod go.sum ./
# GONOSUMDB=* skips checksum DB verification so an empty go.sum is fine —
# Docker will populate it on first build
RUN GONOSUMDB="*" GOFLAGS="-mod=mod" go mod download

COPY . .
RUN GONOSUMDB="*" GOFLAGS="-mod=mod" CGO_ENABLED=0 GOOS=linux \
    go build -ldflags="-s -w" -o /server ./cmd/server/...

FROM alpine:3.20
RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=builder /server .

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["./server"]
