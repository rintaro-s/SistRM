# vrm-server

Go WebSocket server for real-time VRM avatar state synchronization.

## Features

- Room-based multiplayer instances
- JSON WebSocket protocol
- Client-authoritative avatar state with server validation
- Periodic full-state snapshots + immediate delta broadcasts
- REST API for room management
- Static asset serving for VRM files
- BoltDB room persistence + SQLite user/avatar metadata

## Quick Start

```bash
cd vrm-server
go run ./cmd/server
```

Server listens on `:8080`:
- WebSocket: `ws://localhost:8080/ws`
- REST: `http://localhost:8080/rooms`
- Assets: `http://localhost:8080/assets/...`
- Health: `http://localhost:8080/health`

## REST API

```bash
# List rooms
curl http://localhost:8080/rooms

# Create room
curl -X POST http://localhost:8080/rooms \
  -H "Content-Type: application/json" \
  -d '{"name":"My Room","capacity":50}'

# Get room
curl http://localhost:8080/rooms/:id

# Delete room
curl -X DELETE http://localhost:8080/rooms/:id
```

## WebSocket Protocol

### Client → Server

```json
{"type":"join_room","room_id":"lobby","user_id":"user-1","avatar_url":"/assets/avatar.vrm"}
{"type":"avatar_delta","user_id":"user-1","timestamp":1234567890,"transform":{"pos":[0,0,0],"rot":[0,0,0,1],"scale":[1,1,1]},"expressions":{"happy":0.5},"look_at":[1,2,3]}
{"type":"room_event","room_id":"lobby","user_id":"user-1","event_type":"chat","payload":{"text":"hello"}}
{"type":"heartbeat","timestamp":1234567890}
```

### Server → Client

```json
{"type":"full_state","room_id":"lobby","entities":[{"user_id":"user-1","transform":{...},"expressions":{...}}]}
{"type":"avatar_delta","user_id":"user-2","timestamp":1234567890,"transform":{...}}
{"type":"room_event","event_type":"user_joined","payload":{"user_id":"user-2"}}
```

## Rate Limits

- `avatar_delta`: 20/second per client
- `room_event`: 5/second per client
