#!/usr/bin/env bash
# Smoke test: full lifecycle for every writable resource group; read checks for the rest.
# Usage: JK_BASE_URL=<site url> JK_API_KEY=<key for a throwaway user> bash smoke.sh
set -euo pipefail

fail() { echo "SMOKE FAIL: $1" >&2; exit 1; }
need() { command -v "$1" >/dev/null || fail "$1 not installed"; }
need jk; need jq
[ -n "${JK_BASE_URL:-}" ] || fail "set JK_BASE_URL"
[ -n "${JK_API_KEY:-}" ] || fail "set JK_API_KEY (throwaway user's key — smoke writes and deletes records)"

echo "== auth =="
jk auth status | jq -e '.authenticated' >/dev/null || fail "auth status"

echo "== jobs =="
JOB_ID=$(jk jobs add --company "Smoke Co" --title "Smoke Engineer" --link "https://example.com/smoke" | jq -r '.')
[ -n "$JOB_ID" ] || fail "job add"
jk jobs get --id "$JOB_ID" | jq -e '.status=="Interested"' >/dev/null || fail "job get"
jk jobs update --id "$JOB_ID" --status Applied --notes "smoke note" >/dev/null
jk jobs get --id "$JOB_ID" | jq -e '.status=="Applied" and .notes=="smoke note"' >/dev/null || fail "job update"
jk jobs list --status Applied | jq -e "[.[] | select(._id==\"$JOB_ID\")] | length == 1" >/dev/null || fail "job list filter"
jk jobs delete --id "$JOB_ID" --yes >/dev/null
jk jobs list | jq -e "[.[] | select(._id==\"$JOB_ID\")] | length == 0" >/dev/null || fail "job delete"

echo "== emailtemplates =="
ET_ID=$(jk emailtemplates add --name "smoke tpl" --type followup --content '{"template":"Hi {name}","variables":["name"]}' | jq -r '.')
jk emailtemplates update --id "$ET_ID" --name "smoke tpl v2" >/dev/null
jk emailtemplates list | jq -e '.[] | select(.name=="smoke tpl v2")' >/dev/null || fail "emailtemplate update"
jk emailtemplates delete --id "$ET_ID" --yes >/dev/null

echo "== resources =="
RES_ID=$(jk resources add --title "smoke resource" --url "https://example.com/r" --tags '["smoke"]' | jq -r '.')
jk resources update --id "$RES_ID" --notes "updated" >/dev/null
jk resources list | jq -e '.[] | select(.title=="smoke resource") | .notes=="updated"' >/dev/null || fail "resource update"
jk resources delete --id "$RES_ID" --yes >/dev/null

echo "== resumes & coverletters (read-only checks) =="
jk resumes list | jq -e 'type=="array"' >/dev/null || fail "resumes list"
jk coverletters list | jq -e 'type=="array"' >/dev/null || fail "coverletters list"

echo "== threads & schema =="
jk threads list | jq -e 'type=="array"' >/dev/null || fail "threads list"
jk schema | jq -e '.routes | length > 20' >/dev/null || fail "schema"

echo "SMOKE PASS"
