#!/bin/bash
# Usage: scaffold.sh <Subject> <verb> <context>

SUBJECT="$1"
VERB="$2"
CONTEXT="$3"

[ -z "$SUBJECT" ] || [ -z "$VERB" ] || [ -z "$CONTEXT" ] && {
  echo "Usage: scaffold.sh <Subject> <verb> <context>" >&2; exit 1
}

TEST_ROOT="tests"
SUBJECT_FILE="$(echo "$SUBJECT" | awk '{print tolower(substr($0,1,1)) substr($0,2)}')"

# Context-to-source path mapping (matches existing project conventions)
case "$CONTEXT" in
  ssg-core)
    SRC_FILE="lib/${SUBJECT_FILE}.js"
    ;;
  editor)
    SRC_FILE="packages/editor/js/${SUBJECT_FILE}.js"
    ;;
  category)
    SRC_FILE="packages/category/${SUBJECT_FILE}.js"
    ;;
  *)
    SRC_FILE="lib/${CONTEXT}/${SUBJECT_FILE}.js"
    mkdir -p "lib/${CONTEXT}"
    ;;
esac

TEST_FILE="${TEST_ROOT}/${CONTEXT}/${SUBJECT_FILE}.test.js"
SRC_DIR="$(dirname "$SRC_FILE")"
mkdir -p "$SRC_DIR"

add_stub() {
  echo ""
  echo "/**"
  echo " * @vocab $SUBJECT (docs/dictionary.md)"
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
