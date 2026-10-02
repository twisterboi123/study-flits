CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('leerling','leerkracht')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE TABLE classrooms (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_classrooms_owner ON classrooms(owner_id);
CREATE TABLE memberships (classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY(classroom_id,user_id));
CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE TABLE activities (id TEXT PRIMARY KEY, classroom_id TEXT NOT NULL REFERENCES classrooms(id) ON DELETE CASCADE, title TEXT NOT NULL, direction TEXT NOT NULL, questions_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX idx_activities_classroom ON activities(classroom_id,created_at);
