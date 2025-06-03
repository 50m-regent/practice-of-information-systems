-- テーブルの作成
CREATE TABLE IF NOT EXISTS genres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  genre_id INTEGER,
  difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 9),
  spotify_id TEXT,
  jacket_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (genre_id) REFERENCES genres (id)
);

CREATE TABLE IF NOT EXISTS sheet_music (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  song_id INTEGER NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (song_id) REFERENCES songs (id)
);

-- 既存データの削除（テストデータを再投入する前にクリーンアップ）
DELETE FROM sheet_music;
DELETE FROM songs;
DELETE FROM genres;

-- ジャンルの追加
INSERT INTO genres (name) VALUES
  ('J-POP'),
  ('アニメ'),
  ('ロック'),
  ('バラード');

-- 楽曲データの追加
INSERT INTO songs (title, artist, genre_id, difficulty, spotify_id, jacket_url, created_at, updated_at) VALUES
  ('LADY', 'Kenshi Yonezu', 1, 4, '5wuCKEuQxoIHxEWCScYVGl', 'https://i.scdn.co/image/ab67616d0000b273f3f3c3d23188d8d81d6d5eff', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('アイドル', 'YOASOBI', 1, 5, '1WhJTZ1MmvGCCvhMS5e1zk', 'https://i.scdn.co/image/ab67616d0000b273f0d9c7a2ca68867c95304d08', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('Subtitle', 'Official HIGE DANdism', 1, 6, '19CvkAk4lc0sYVkYzM8CoF', 'https://i.scdn.co/image/ab67616d0000b273af8c31fd0abc27f70f516232', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('新時代', 'Ado', 2, 7, '6yZKWXxyhpP1NtRGIusJB6', 'https://i.scdn.co/image/ab67616d0000b273f9b2941d39b5da2c5d4f5e35', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('魔法の絨毯', 'Awesome City Club', 1, 3, '2YnZphJUDPJmBHcttXFYpP', 'https://i.scdn.co/image/ab67616d0000b273e9c4a0f0b6a7323a7ba5b901', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- 楽譜データの追加（ダミーデータ）
INSERT INTO sheet_music (song_id, notes, created_at, updated_at) VALUES
  (1, '[{"pitch": "C4", "duration": "1/4", "position": 0}, {"pitch": "E4", "duration": "1/4", "position": 1}]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (2, '[{"pitch": "D4", "duration": "1/4", "position": 0}, {"pitch": "F4", "duration": "1/4", "position": 1}]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (3, '[{"pitch": "E4", "duration": "1/4", "position": 0}, {"pitch": "G4", "duration": "1/4", "position": 1}]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (4, '[{"pitch": "F4", "duration": "1/4", "position": 0}, {"pitch": "A4", "duration": "1/4", "position": 1}]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (5, '[{"pitch": "G4", "duration": "1/4", "position": 0}, {"pitch": "B4", "duration": "1/4", "position": 1}]', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP); 