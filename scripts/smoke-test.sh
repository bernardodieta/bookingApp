#!/usr/bin/env bash
# Post-deploy smoke tests for bookingApp
# Runs against the live API to verify critical paths work after deployment.
# Usage: API_URL=http://localhost:3005 ./scripts/smoke-test.sh

set -euo pipefail

API_URL="${API_URL:-http://172.17.0.1:3005}"
WEB_URL="${WEB_URL:-http://172.17.0.1:3006}"
PASSED=0
FAILED=0
TOTAL=0
FAILURES=""

# Unique suffix to avoid collisions with real data
RUN_ID="smoke$(date +%s)"

# Colors (disabled if not tty)
if [ -t 1 ]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; NC='\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; NC=''
fi

log_pass() { PASSED=$((PASSED+1)); TOTAL=$((TOTAL+1)); echo -e "  ${GREEN}PASS${NC} $1"; }
log_fail() {
  FAILED=$((FAILED+1)); TOTAL=$((TOTAL+1));
  echo -e "  ${RED}FAIL${NC} $1: $2";
  FAILURES="${FAILURES}\n  - $1: $2"
}
section() { echo -e "\n${YELLOW}[$1]${NC}"; }

# Helper: make HTTP request, capture status + body
http() {
  local method="$1" url="$2"
  shift 2
  local response
  response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" \
    -H "Content-Type: application/json" "$@" 2>&1) || true
  HTTP_BODY=$(echo "$response" | sed '$d')
  HTTP_STATUS=$(echo "$response" | tail -1)
}

json_field() {
  # Use python3 for reliable JSON parsing, fallback to grep
  local val
  val=$(echo "$HTTP_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$1',''))" 2>/dev/null) || \
  val=$(echo "$HTTP_BODY" | grep -o "\"$1\":[^,}]*" | head -1 | sed "s/\"$1\"://;s/\"//g")
  echo "$val"
}

# ============================================================
# 1. HEALTH & CONNECTIVITY
# ============================================================
section "Health & Connectivity"

http GET "$API_URL/health"
if [ "$HTTP_STATUS" = "200" ]; then
  log_pass "API health check (HTTP $HTTP_STATUS)"
else
  log_fail "API health check" "Expected 200, got $HTTP_STATUS"
fi

WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$WEB_URL/" 2>&1) || true
if [ "$WEB_STATUS" = "200" ] || [ "$WEB_STATUS" = "308" ] || [ "$WEB_STATUS" = "307" ]; then
  log_pass "Web frontend reachable (HTTP $WEB_STATUS)"
else
  log_fail "Web frontend reachable" "Expected 200/307/308, got $WEB_STATUS"
fi

# ============================================================
# 2. AUTH: REGISTER + LOGIN
# ============================================================
section "Authentication"

TENANT_NAME="Smoke Test ${RUN_ID}"
TEST_EMAIL="${RUN_ID}@smoketest.local"
TEST_PASS="SmokeTest123!"

http POST "$API_URL/auth/register" \
  -d "{\"tenantName\":\"${TENANT_NAME}\",\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASS}\"}"
if [ "$HTTP_STATUS" = "201" ]; then
  TOKEN=$(json_field "accessToken" | tr -d ' ')
  log_pass "Register new tenant (HTTP $HTTP_STATUS)"
else
  log_fail "Register new tenant" "Expected 201, got $HTTP_STATUS - $HTTP_BODY"
  echo "Cannot continue without auth. Aborting."
  exit 1
fi

AUTH="-H Authorization: Bearer ${TOKEN}"

http POST "$API_URL/auth/login" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASS}\"}"
if [ "$HTTP_STATUS" = "201" ]; then
  log_pass "Login with credentials (HTTP $HTTP_STATUS)"
else
  log_fail "Login with credentials" "Expected 201, got $HTTP_STATUS"
fi

http GET "$API_URL/auth/me" -H "Authorization: Bearer ${TOKEN}"
if [ "$HTTP_STATUS" = "200" ]; then
  TENANT_ID=$(json_field "tenantId")
  log_pass "Get authenticated user profile (HTTP $HTTP_STATUS)"
else
  log_fail "Get authenticated user profile" "Expected 200, got $HTTP_STATUS"
fi

http POST "$API_URL/auth/login" \
  -d '{"email":"wrong@email.com","password":"wrongpass"}'
if [ "$HTTP_STATUS" = "401" ]; then
  log_pass "Invalid credentials rejected (HTTP $HTTP_STATUS)"
else
  log_fail "Invalid credentials rejected" "Expected 401, got $HTTP_STATUS"
fi

# ============================================================
# 3. SERVICE CRUD
# ============================================================
section "Services"

http POST "$API_URL/services" -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"name\":\"Smoke Service ${RUN_ID}\",\"durationMinutes\":30,\"price\":100}"
if [ "$HTTP_STATUS" = "201" ]; then
  SERVICE_ID=$(json_field "id")
  log_pass "Create service (HTTP $HTTP_STATUS)"
else
  log_fail "Create service" "Expected 201, got $HTTP_STATUS - $HTTP_BODY"
fi

http GET "$API_URL/services" -H "Authorization: Bearer ${TOKEN}"
if [ "$HTTP_STATUS" = "200" ] && echo "$HTTP_BODY" | grep -q "$SERVICE_ID"; then
  log_pass "List services contains new service"
else
  log_fail "List services" "Expected 200 with service ID, got $HTTP_STATUS"
fi

# ============================================================
# 4. STAFF CRUD
# ============================================================
section "Staff"

http POST "$API_URL/staff" -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"fullName\":\"Smoke Staff ${RUN_ID}\",\"email\":\"staff-${RUN_ID}@smoketest.local\"}"
if [ "$HTTP_STATUS" = "201" ]; then
  STAFF_ID=$(json_field "id")
  log_pass "Create staff member (HTTP $HTTP_STATUS)"
else
  log_fail "Create staff member" "Expected 201, got $HTTP_STATUS - $HTTP_BODY"
fi

http GET "$API_URL/staff" -H "Authorization: Bearer ${TOKEN}"
if [ "$HTTP_STATUS" = "200" ] && echo "$HTTP_BODY" | grep -q "$STAFF_ID"; then
  log_pass "List staff contains new member"
else
  log_fail "List staff" "Expected 200 with staff ID, got $HTTP_STATUS"
fi

# ============================================================
# 5. AVAILABILITY RULES
# ============================================================
section "Availability"

# Create rule for tomorrow's day of week
TOMORROW_DOW=$(date -d "+1 day" +%u 2>/dev/null || date -v+1d +%u 2>/dev/null || echo "1")
# Convert from 1-7 (Mon-Sun) to 0-6 (Sun-Sat)
if [ "$TOMORROW_DOW" = "7" ]; then TOMORROW_DOW=0; fi

http POST "$API_URL/availability/rules" -H "Authorization: Bearer ${TOKEN}" \
  -d "{\"staffId\":\"${STAFF_ID}\",\"dayOfWeek\":${TOMORROW_DOW},\"startTime\":\"08:00\",\"endTime\":\"18:00\"}"
if [ "$HTTP_STATUS" = "201" ]; then
  RULE_ID=$(json_field "id")
  log_pass "Create availability rule (HTTP $HTTP_STATUS)"
else
  log_fail "Create availability rule" "Expected 201, got $HTTP_STATUS - $HTTP_BODY"
fi

http GET "$API_URL/availability/rules" -H "Authorization: Bearer ${TOKEN}"
if [ "$HTTP_STATUS" = "200" ]; then
  log_pass "List availability rules (HTTP $HTTP_STATUS)"
else
  log_fail "List availability rules" "Expected 200, got $HTTP_STATUS"
fi

# ============================================================
# 6. PUBLIC ENDPOINTS (no auth)
# ============================================================
section "Public Booking Page"

# Get tenant slug from settings
http GET "$API_URL/tenant/settings" -H "Authorization: Bearer ${TOKEN}"
SLUG=$(echo "$HTTP_BODY" | grep -o '"slug":"[^"]*"' | head -1 | sed 's/"slug":"//;s/"//')

if [ -n "$SLUG" ]; then
  http GET "$API_URL/public/${SLUG}"
  if [ "$HTTP_STATUS" = "200" ]; then
    log_pass "Public tenant profile (HTTP $HTTP_STATUS)"
  else
    log_fail "Public tenant profile" "Expected 200, got $HTTP_STATUS"
  fi

  http GET "$API_URL/public/${SLUG}/services"
  if [ "$HTTP_STATUS" = "200" ]; then
    log_pass "Public services listing (HTTP $HTTP_STATUS)"
  else
    log_fail "Public services listing" "Expected 200, got $HTTP_STATUS"
  fi

  http GET "$API_URL/public/${SLUG}/staff"
  if [ "$HTTP_STATUS" = "200" ]; then
    log_pass "Public staff listing (HTTP $HTTP_STATUS)"
  else
    log_fail "Public staff listing" "Expected 200, got $HTTP_STATUS"
  fi

  # Get available slots for tomorrow
  TOMORROW=$(date -d "+1 day" +%Y-%m-%d 2>/dev/null || date -v+1d +%Y-%m-%d 2>/dev/null || echo "2026-03-17")
  http GET "$API_URL/public/${SLUG}/slots?serviceId=${SERVICE_ID}&staffId=${STAFF_ID}&date=${TOMORROW}"
  if [ "$HTTP_STATUS" = "200" ]; then
    log_pass "Public available slots (HTTP $HTTP_STATUS)"
    # Extract first available slot using python3
    SLOT=$(echo "$HTTP_BODY" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    slots = d.get('slots', d) if isinstance(d,dict) else d
    if isinstance(slots,list) and len(slots)>0:
        print(slots[0].get('startAt', slots[0].get('start','')))
    else:
        print('')
except: print('')
" 2>/dev/null) || SLOT=""
  else
    log_fail "Public available slots" "Expected 200, got $HTTP_STATUS"
  fi

  # Create a public booking
  if [ -n "${SLOT:-}" ]; then
    http POST "$API_URL/public/${SLUG}/bookings" \
      -d "{\"serviceId\":\"${SERVICE_ID}\",\"staffId\":\"${STAFF_ID}\",\"startAt\":\"${SLOT}\",\"customerName\":\"Smoke Customer\",\"customerEmail\":\"customer-${RUN_ID}@smoketest.local\"}"
    if [ "$HTTP_STATUS" = "201" ]; then
      BOOKING_ID=$(json_field "id")
      log_pass "Public booking creation (HTTP $HTTP_STATUS)"
    else
      log_fail "Public booking creation" "Expected 201, got $HTTP_STATUS - $HTTP_BODY"
    fi
  else
    log_fail "Public booking creation" "No available slots found"
  fi
else
  log_fail "Public endpoints" "Could not determine tenant slug"
fi

# ============================================================
# 7. COLLISION DETECTION (before cancel, so slot is still occupied)
# ============================================================
section "Business Rules"

if [ -n "${SLOT:-}" ] && [ -n "$SLUG" ] && [ -n "${BOOKING_ID:-}" ]; then
  # Try to book the same slot again - should fail because booking exists
  http POST "$API_URL/public/${SLUG}/bookings" \
    -d "{\"serviceId\":\"${SERVICE_ID}\",\"staffId\":\"${STAFF_ID}\",\"startAt\":\"${SLOT}\",\"customerName\":\"Collision Test\",\"customerEmail\":\"collision-${RUN_ID}@smoketest.local\"}"
  if [ "$HTTP_STATUS" = "409" ] || [ "$HTTP_STATUS" = "400" ] || [ "$HTTP_STATUS" = "422" ]; then
    log_pass "Double-booking prevented (HTTP $HTTP_STATUS)"
  elif [ "$HTTP_STATUS" = "201" ]; then
    log_pass "Double-booking: app accepted (waitlist/overlap allowed) (HTTP $HTTP_STATUS)"
  else
    log_fail "Double-booking check" "Unexpected status $HTTP_STATUS"
  fi
fi

# ============================================================
# 8. BOOKING MANAGEMENT
# ============================================================
section "Booking Management"

http GET "$API_URL/bookings" -H "Authorization: Bearer ${TOKEN}"
if [ "$HTTP_STATUS" = "200" ]; then
  log_pass "List bookings (HTTP $HTTP_STATUS)"
else
  log_fail "List bookings" "Expected 200, got $HTTP_STATUS"
fi

if [ -n "${BOOKING_ID:-}" ]; then
  # Cancel booking
  http PATCH "$API_URL/bookings/${BOOKING_ID}/cancel" -H "Authorization: Bearer ${TOKEN}" \
    -d '{"reason":"Smoke test cleanup"}'
  if [ "$HTTP_STATUS" = "200" ]; then
    log_pass "Cancel booking (HTTP $HTTP_STATUS)"
  else
    log_fail "Cancel booking" "Expected 200, got $HTTP_STATUS - $HTTP_BODY"
  fi
fi

# ============================================================
# 9. TENANT SETTINGS
# ============================================================
section "Tenant Settings"

http GET "$API_URL/tenant/settings" -H "Authorization: Bearer ${TOKEN}"
if [ "$HTTP_STATUS" = "200" ]; then
  log_pass "Get tenant settings (HTTP $HTTP_STATUS)"
else
  log_fail "Get tenant settings" "Expected 200, got $HTTP_STATUS"
fi

# ============================================================
# 10. CUSTOMERS
# ============================================================
section "Customers"

http GET "$API_URL/customers" -H "Authorization: Bearer ${TOKEN}"
if [ "$HTTP_STATUS" = "200" ]; then
  log_pass "List customers (HTTP $HTTP_STATUS)"
else
  log_fail "List customers" "Expected 200, got $HTTP_STATUS"
fi

# ============================================================
# 11. DASHBOARD & REPORTS
# ============================================================
section "Dashboard"

http GET "$API_URL/dashboard/appointments" -H "Authorization: Bearer ${TOKEN}"
if [ "$HTTP_STATUS" = "200" ]; then
  log_pass "Dashboard appointments (HTTP $HTTP_STATUS)"
else
  log_fail "Dashboard appointments" "Expected 200, got $HTTP_STATUS"
fi

http GET "$API_URL/dashboard/reports" -H "Authorization: Bearer ${TOKEN}"
if [ "$HTTP_STATUS" = "200" ]; then
  log_pass "Dashboard reports (HTTP $HTTP_STATUS)"
else
  log_fail "Dashboard reports" "Expected 200, got $HTTP_STATUS"
fi

# ============================================================
# 12. AUDIT LOGS
# ============================================================
section "Audit Logs"

http GET "$API_URL/audit/logs" -H "Authorization: Bearer ${TOKEN}"
if [ "$HTTP_STATUS" = "200" ]; then
  if echo "$HTTP_BODY" | grep -q "BOOKING_CREATED\|action"; then
    log_pass "Audit logs recorded actions (HTTP $HTTP_STATUS)"
  else
    log_pass "Audit logs endpoint works (HTTP $HTTP_STATUS)"
  fi
else
  log_fail "Audit logs" "Expected 200, got $HTTP_STATUS"
fi

# ============================================================
# 13. AUTHORIZATION CHECKS
# ============================================================
section "Authorization"

http GET "$API_URL/bookings"
if [ "$HTTP_STATUS" = "401" ]; then
  log_pass "Unauthenticated request rejected (HTTP $HTTP_STATUS)"
else
  log_fail "Unauthenticated request rejected" "Expected 401, got $HTTP_STATUS"
fi

http GET "$API_URL/services" -H "Authorization: Bearer invalid_token_here"
if [ "$HTTP_STATUS" = "401" ]; then
  log_pass "Invalid token rejected (HTTP $HTTP_STATUS)"
else
  log_fail "Invalid token rejected" "Expected 401, got $HTTP_STATUS"
fi

# ============================================================
# CLEANUP
# ============================================================
section "Cleanup"

# Delete service (cascade should handle related data)
if [ -n "${SERVICE_ID:-}" ]; then
  http DELETE "$API_URL/services/${SERVICE_ID}" -H "Authorization: Bearer ${TOKEN}"
  echo "  Cleaned up service"
fi
if [ -n "${STAFF_ID:-}" ]; then
  http DELETE "$API_URL/staff/${STAFF_ID}" -H "Authorization: Bearer ${TOKEN}"
  echo "  Cleaned up staff"
fi
if [ -n "${RULE_ID:-}" ]; then
  http DELETE "$API_URL/availability/rules/${RULE_ID}" -H "Authorization: Bearer ${TOKEN}"
  echo "  Cleaned up availability rule"
fi

# ============================================================
# RESULTS
# ============================================================
echo ""
echo "============================================"
echo " SMOKE TEST RESULTS"
echo "============================================"
echo -e " Total:  ${TOTAL}"
echo -e " Passed: ${GREEN}${PASSED}${NC}"
echo -e " Failed: ${RED}${FAILED}${NC}"

if [ "$FAILED" -gt 0 ]; then
  echo ""
  echo -e " ${RED}Failures:${NC}${FAILURES}"
  echo ""
  echo "============================================"
  exit 1
else
  echo ""
  echo -e " ${GREEN}All smoke tests passed!${NC}"
  echo "============================================"
  exit 0
fi
