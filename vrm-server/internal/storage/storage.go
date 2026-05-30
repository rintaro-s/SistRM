package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
	bolt "go.etcd.io/bbolt"
	"github.com/google/uuid"
)

var (
	boltDB     *bolt.DB
	sqliteDB   *sql.DB
	dataDir    string
)

// Init initializes both BoltDB and SQLite databases.
func Init(dir string) error {
	dataDir = dir
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return fmt.Errorf("failed to create data dir: %w", err)
	}

	if err := initBoltDB(); err != nil {
		return err
	}
	if err := initSQLite(); err != nil {
		return err
	}
	return nil
}

// Close closes all database connections.
func Close() {
	if boltDB != nil {
		boltDB.Close()
	}
	if sqliteDB != nil {
		sqliteDB.Close()
	}
}

// --- BoltDB (Room Persistence) ---

func initBoltDB() error {
	path := filepath.Join(dataDir, "rooms.bolt")
	db, err := bolt.Open(path, 0600, &bolt.Options{Timeout: 1 * time.Second})
	if err != nil {
		return fmt.Errorf("failed to open bolt db: %w", err)
	}
	boltDB = db

	return boltDB.Update(func(tx *bolt.Tx) error {
		_, err := tx.CreateBucketIfNotExists([]byte("rooms"))
		if err != nil {
			return fmt.Errorf("create bucket: %w", err)
		}
		_, err = tx.CreateBucketIfNotExists([]byte("room_states"))
		return err
	})
}

// RoomRecord is stored in BoltDB.
type RoomRecord struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Capacity  int       `json:"capacity"`
	CreatedAt time.Time `json:"created_at"`
}

// SaveRoom persists a room record to BoltDB.
func SaveRoom(r RoomRecord) (RoomRecord, error) {
	if r.ID == "" {
		r.ID = uuid.New().String()
	}
	if r.CreatedAt.IsZero() {
		r.CreatedAt = time.Now().UTC()
	}
	data, err := json.Marshal(r)
	if err != nil {
		return r, err
	}
	err = boltDB.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte("rooms"))
		return b.Put([]byte(r.ID), data)
	})
	return r, err
}

// GetRoom retrieves a room record from BoltDB.
func GetRoom(id string) (*RoomRecord, error) {
	var r RoomRecord
	err := boltDB.View(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte("rooms"))
		v := b.Get([]byte(id))
		if v == nil {
			return fmt.Errorf("room not found")
		}
		return json.Unmarshal(v, &r)
	})
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// DeleteRoom removes a room from BoltDB.
func DeleteRoom(id string) error {
	return boltDB.Update(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte("rooms"))
		return b.Delete([]byte(id))
	})
}

// ListRooms returns all stored room records.
func ListRooms() ([]RoomRecord, error) {
	var rooms []RoomRecord
	err := boltDB.View(func(tx *bolt.Tx) error {
		b := tx.Bucket([]byte("rooms"))
		return b.ForEach(func(k, v []byte) error {
			var r RoomRecord
			if err := json.Unmarshal(v, &r); err != nil {
				return err
			}
			rooms = append(rooms, r)
			return nil
		})
	})
	return rooms, err
}

// --- SQLite (User/Avatar Metadata) ---

func initSQLite() error {
	path := filepath.Join(dataDir, "metadata.db")
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return fmt.Errorf("failed to open sqlite: %w", err)
	}
	sqliteDB = db

	schema := `
	CREATE TABLE IF NOT EXISTS users (
		id TEXT PRIMARY KEY,
		display_name TEXT NOT NULL,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	);
	CREATE TABLE IF NOT EXISTS avatars (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		name TEXT NOT NULL,
		vrm_path TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (user_id) REFERENCES users(id)
	);
	`
	if _, err := db.Exec(schema); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}
	return nil
}

// User represents a user in the system.
type User struct {
	ID          string    `json:"id"`
	DisplayName string    `json:"display_name"`
	CreatedAt   time.Time `json:"created_at"`
}

// CreateUser inserts a new user into SQLite.
func CreateUser(u User) error {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	_, err := sqliteDB.Exec(
		"INSERT INTO users (id, display_name) VALUES (?, ?)",
		u.ID, u.DisplayName,
	)
	return err
}

// GetUser retrieves a user by ID.
func GetUser(id string) (*User, error) {
	row := sqliteDB.QueryRow("SELECT id, display_name, created_at FROM users WHERE id = ?", id)
	var u User
	if err := row.Scan(&u.ID, &u.DisplayName, &u.CreatedAt); err != nil {
		return nil, err
	}
	return &u, nil
}

// Avatar represents an avatar record.
type Avatar struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	VRMPath   string    `json:"vrm_path"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateAvatar inserts a new avatar record.
func CreateAvatar(a Avatar) error {
	if a.ID == "" {
		a.ID = uuid.New().String()
	}
	_, err := sqliteDB.Exec(
		"INSERT INTO avatars (id, user_id, name, vrm_path) VALUES (?, ?, ?, ?)",
		a.ID, a.UserID, a.Name, a.VRMPath,
	)
	return err
}

// GetAvatarsByUser returns all avatars owned by a user.
func GetAvatarsByUser(userID string) ([]Avatar, error) {
	rows, err := sqliteDB.Query("SELECT id, user_id, name, vrm_path, created_at FROM avatars WHERE user_id = ?", userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var avatars []Avatar
	for rows.Next() {
		var a Avatar
		if err := rows.Scan(&a.ID, &a.UserID, &a.Name, &a.VRMPath, &a.CreatedAt); err != nil {
			log.Println("scan error:", err)
			continue
		}
		avatars = append(avatars, a)
	}
	return avatars, rows.Err()
}
