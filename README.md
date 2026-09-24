# OpenCode YOLO Mode Plugin

OpenCode V2 用の YOLO mode プラグイン。環境変数 `OPENCODE_YOLO_ENABLE=true` で以下の動作を自動化:

- すべての permission 要求を自動許可
- question tool を利用可能なツール一覧から除外
- system prompt に YOLO mode 有効を通知

## インストール

```bash
bun install
```

## ビルド

```bash
bun run build
```

## プラグインとしてインストール

```bash
bun run plugin:install
```

## 使用方法

```bash
OPENCODE_YOLO_ENABLE=true opencode
```

## テスト

```bash
# Unit tests
bun test

# E2E tests
bun test:integration
```

## 開発

```bash
# Type check
bun typecheck

# Lint
bun lint

# Format
bun format
```
