#!/bin/bash
# Usage: scaffold.sh <Subject> <verb> <context>

SUBJECT="$1"
VERB="$2"
CONTEXT="$3"

[ -z "$SUBJECT" ] || [ -z "$VERB" ] || [ -z "$CONTEXT" ] && {
  echo "Usage: scaffold.sh <Subject> <verb> <context>" >&2; exit 1
}

# @vocab は概念名のみ（パス付記は checker の誤検出を招く）。
# 英語 Subject から docs/dictionary.json の日本語概念名を逆引きする。見つからなければ Subject をそのまま使う。
VOCAB_NAME="$(node -e '
  const fs = require("fs")
  const [en, ctx] = process.argv.slice(1)
  try {
    const d = JSON.parse(fs.readFileSync("docs/dictionary.json", "utf8"))
    const hit = d.entries.find(e => e.en === en && e.context === ctx) || d.entries.find(e => e.en === en)
    process.stdout.write(hit ? hit.name : en)
  } catch { process.stdout.write(en) }
' "$SUBJECT" "$CONTEXT")"

SUBJECT_FILE="$(echo "$SUBJECT" | awk '{print tolower(substr($0,1,1)) substr($0,2)}')"

# ---- native-shell: Swift (native/ 配下、NativeShellCore ターゲット) ----
if [ "$CONTEXT" = "native-shell" ]; then
  SRC_FILE="native/Sources/NativeShellCore/${SUBJECT}.swift"
  TEST_FILE="native/Tests/NativeShellCoreTests/${SUBJECT}Tests.swift"
  mkdir -p "$(dirname "$SRC_FILE")"

  if [ ! -f "$SRC_FILE" ]; then
    {
      echo "import Foundation"
      echo ""
      echo "/// @vocab $VOCAB_NAME"
      echo "/// @test $TEST_FILE"
      echo "public enum $SUBJECT {"
      echo "  public static func $VERB() {"
      echo "    fatalError(\"not implemented\")"
      echo "  }"
      echo "}"
    } > "$SRC_FILE"
    echo "Created: $SRC_FILE"
  else
    {
      echo ""
      echo "/// @vocab $VOCAB_NAME"
      echo "/// @test $TEST_FILE"
      echo "extension $SUBJECT {"
      echo "  public static func $VERB() {"
      echo "    fatalError(\"not implemented\")"
      echo "  }"
      echo "}"
    } >> "$SRC_FILE"
    echo "Appended ${VERB} to: $SRC_FILE"
  fi
  exit 0
fi

# ---- JavaScript コンテキスト ----
TEST_ROOT="tests"

# Context-to-source path mapping (matches existing project conventions)
case "$CONTEXT" in
  ssg-core)
    SRC_FILE="lib/${SUBJECT_FILE}.js"
    ;;
  server)
    SRC_FILE="lib/server/${SUBJECT_FILE}.js"
    ;;
  dev-server)
    # 開発サーバー系のソース（watcher.js 等）は lib/ 直下に置かれている
    SRC_FILE="lib/${SUBJECT_FILE}.js"
    ;;
  editor)
    SRC_FILE="packages/editor/js/${SUBJECT_FILE}.js"
    ;;
  category)
    SRC_FILE="packages/category/${SUBJECT_FILE}.js"
    ;;
  app-bundle)
    SRC_FILE="scripts/app-bundle/${SUBJECT_FILE}.js"
    ;;
  *)
    SRC_FILE="lib/${CONTEXT}/${SUBJECT_FILE}.js"
    ;;
esac

TEST_FILE="${TEST_ROOT}/${CONTEXT}/${SUBJECT_FILE}.test.js"
mkdir -p "$(dirname "$SRC_FILE")"

add_stub() {
  echo ""
  echo "/**"
  echo " * @vocab $VOCAB_NAME"
  echo " * @test $TEST_FILE"
  echo " */"
  echo "export function $VERB() {"
  echo "  throw new Error('not implemented')"
  echo "}"
}

if [ ! -f "$SRC_FILE" ]; then
  add_stub > "$SRC_FILE"
  echo "Created: $SRC_FILE"
else
  add_stub >> "$SRC_FILE"
  echo "Appended ${VERB} to: $SRC_FILE"
fi
