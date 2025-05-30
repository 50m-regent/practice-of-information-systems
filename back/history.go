package main

import (
	"database/sql"
	"fmt"
	"log"
	"time"
)

const (
	// maxStoredHistoryItems は SearchHistory テーブルに保持する最大アイテム数です。
	maxStoredHistoryItems = 20
	// defaultHistoryLimit は /history/searches エンドポイントで返されるデフォルトのアイテム数です。
	defaultHistoryLimit = 10
)

// AddSearchEntriesToHistory は検索結果の楽曲リストを検索履歴に追加します。
// 追加後、履歴テーブルが最大保持数を超えないように古いエントリを削除します。
func AddSearchEntriesToHistory(db *sql.DB, items []DisplayMusic) error {
	if len(items) == 0 {
		return nil
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("検索履歴のトランザクション開始に失敗しました: %w", err)
	}
	// エラー時にロールバックを保証します
	successfulCommit := false
	defer func() {
		if !successfulCommit {
			tx.Rollback()
		}
	}()

	stmt, err := tx.Prepare("INSERT INTO SearchHistory (music_id, title, artist, thumbnail, searched_at) VALUES (?, ?, ?, ?, ?)")
	if err != nil {
		return fmt.Errorf("検索履歴のINSERT準備に失敗しました: %w", err)
	}
	defer stmt.Close()

	currentTime := time.Now().UTC() // このバッチ内の全アイテムに同じタイムスタンプを使用

	for _, item := range items {
		_, err = stmt.Exec(item.MusicID, item.Title, item.Artist, item.Thumbnail, currentTime)
		if err != nil {
			return fmt.Errorf("検索履歴エントリの挿入に失敗しました (music_id: %d): %w", item.MusicID, err)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("検索履歴のコミットに失敗しました: %w", err)
	}
	successfulCommit = true // コミット成功

	// 新しいエントリのコミット成功後に古いエントリを削除
	if err := PruneSearchHistory(db, maxStoredHistoryItems); err != nil {
		// このエラーはログに記録しますが、履歴追加の主操作を失敗させません
		log.Printf("警告: 検索履歴の削除に失敗しました: %v", err)
	}

	log.Printf("%d 件のエントリを検索履歴に追加しました。", len(items))
	return nil
}

// PruneSearchHistory は SearchHistory テーブルに最新の 'keepCount' 件のアイテムのみを保持します。
func PruneSearchHistory(db *sql.DB, keepCount int) error {
	query := `
		DELETE FROM SearchHistory
		WHERE id NOT IN (
			SELECT id
			FROM SearchHistory
			ORDER BY searched_at DESC, id DESC
			LIMIT ?
		)
	`
	_, err := db.Exec(query, keepCount)
	if err != nil {
		return fmt.Errorf("検索履歴の削除クエリ実行に失敗しました: %w", err)
	}
	return nil
}

// GetSearchHistory は最新の検索履歴アイテムを取得します。
func GetSearchHistory(db *sql.DB, limit int) ([]DisplayMusic, error) {
	if limit <= 0 {
		limit = defaultHistoryLimit
	}

	rows, err := db.Query("SELECT music_id, title, artist, thumbnail FROM SearchHistory ORDER BY searched_at DESC, id DESC LIMIT ?", limit)
	if err != nil {
		return nil, fmt.Errorf("検索履歴のクエリ実行に失敗しました: %w", err)
	}
	defer rows.Close()

	var history []DisplayMusic
	for rows.Next() {
		var dm DisplayMusic
		if err := rows.Scan(&dm.MusicID, &dm.Title, &dm.Artist, &dm.Thumbnail); err != nil {
			return nil, fmt.Errorf("検索履歴行のスキャンに失敗しました: %w", err)
		}
		history = append(history, dm)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("検索履歴行のイテレーションエラー: %w", err)
	}
	return history, nil
}
