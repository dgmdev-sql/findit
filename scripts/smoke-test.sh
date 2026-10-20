#!/usr/bin/env bash
# ============================================================================
# FindIt — Automated Post-Deploy Smoke Test & Health Check
# Usage: ./scripts/smoke-test.sh [BASE_URL]
# Default BASE_URL: http://localhost:8080
# ============================================================================

set -eo pipefail

BASE_URL="${1:-http://localhost:8080}"
FAILED=0
TOTAL_CHECKS=0
PASSED_CHECKS=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_check() {
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    local description="$1"
    local status="$2"
    local details="$3"

    if [ "$status" -eq 0 ]; then
        PASSED_CHECKS=$((PASSED_CHECKS + 1))
        echo -e "  [${GREEN}PASS${NC}] ${description} ${details}"
    else
        FAILED=1
        echo -e "  [${RED}FAIL${NC}] ${description} ${details}"
    fi
}

echo -e "\n${BLUE}======================================================${NC}"
echo -e "${BLUE}  FindIt — Automated Post-Deploy Smoke Verification   ${NC}"
echo -e "${BLUE}  Target: ${BASE_URL}                                ${NC}"
echo -e "${BLUE}======================================================${NC}\n"

# 1. Reverse Proxy & Student Web UI
echo -e "${YELLOW}Step 1: Checking Web UI via Reverse Proxy...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/" || echo "000")
if [ "$HTTP_CODE" -eq 200 ]; then
    log_check "Student Portal UI (GET /)" 0 "(HTTP 200)"
else
    log_check "Student Portal UI (GET /)" 1 "(HTTP ${HTTP_CODE})"
fi

HTTP_ADMIN_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/admin.html" || echo "000")
if [ "$HTTP_ADMIN_CODE" -eq 200 ]; then
    log_check "ITSO Admin Console (GET /admin.html)" 0 "(HTTP 200)"
else
    log_check "ITSO Admin Console (GET /admin.html)" 1 "(HTTP ${HTTP_ADMIN_CODE})"
fi

# 2. Items API Health Check
echo -e "\n${YELLOW}Step 2: Checking items-api Service...${NC}"
ITEMS_HEALTH=$(curl -s "${BASE_URL}/api/items/health" || echo "")
if echo "$ITEMS_HEALTH" | grep -q '"healthy"'; then
    log_check "Items API Health Endpoint (GET /api/items/health)" 0 "(Service Healthy)"
else
    log_check "Items API Health Endpoint (GET /api/items/health)" 1 "(Response: ${ITEMS_HEALTH})"
fi

ITEMS_LIST=$(curl -s "${BASE_URL}/api/items" || echo "")
if echo "$ITEMS_LIST" | grep -q 'title'; then
    ITEM_COUNT=$(echo "$ITEMS_LIST" | grep -o '"id":' | wc -l || echo "0")
    log_check "Items Catalog Query (GET /api/items)" 0 "(${ITEM_COUNT} items active)"
else
    log_check "Items Catalog Query (GET /api/items)" 1 "(Failed to retrieve catalog)"
fi

# 3. Claims API Health Check
echo -e "\n${YELLOW}Step 3: Checking claims-api Service...${NC}"
CLAIMS_HEALTH=$(curl -s "${BASE_URL}/api/claims/health" || echo "")
if echo "$CLAIMS_HEALTH" | grep -q '"healthy"'; then
    log_check "Claims API Health Endpoint (GET /api/claims/health)" 0 "(Service Healthy)"
else
    log_check "Claims API Health Endpoint (GET /api/claims/health)" 1 "(Response: ${CLAIMS_HEALTH})"
fi

CLAIMS_LIST=$(curl -s "${BASE_URL}/api/claims" || echo "")
if [ -n "$CLAIMS_LIST" ]; then
    log_check "Claims Registry Query (GET /api/claims)" 0 "(Claims endpoint reachable)"
else
    log_check "Claims Registry Query (GET /api/claims)" 1 "(Empty response)"
fi

# 4. End-to-End Item Creation & Claim Approval Test
echo -e "\n${YELLOW}Step 4: Testing End-to-End Item & Claim Workflow...${NC}"
TEST_TITLE="Smoke Test Item $(date +%s)"
CURRENT_DATE=$(date +%Y-%m-%d)
CREATE_JSON=$(printf '{"title":"%s","category":"Other","item_type":"lost","location":"Testing Lab","date_reported":"%s","description":"Automated smoke test verification","reporter_name":"SmokeTester","reporter_contact":"tester@campus.edu.ph"}' "$TEST_TITLE" "$CURRENT_DATE")

CREATE_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/items" \
    -H "Content-Type: application/json" \
    -d "$CREATE_JSON" || echo "")

NEW_ITEM_ID=$(echo "$CREATE_RESPONSE" | grep -o '"id":[0-9]*' | head -n1 | cut -d: -f2 || echo "")

if [ -n "$NEW_ITEM_ID" ] && [ "$NEW_ITEM_ID" -gt 0 ]; then
    log_check "Create Item (POST /api/items)" 0 "(Created Item ID: ${NEW_ITEM_ID})"

    # Submit claim for the created item
    CLAIM_JSON=$(printf '{"item_id":%s,"claimant_name":"SmokeClaimant","student_id":"2024-000000","proof_description":"Automated verification test"}' "$NEW_ITEM_ID")
    CLAIM_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/claims" \
        -H "Content-Type: application/json" \
        -d "$CLAIM_JSON" || echo "")

    NEW_CLAIM_ID=$(echo "$CLAIM_RESPONSE" | grep -o '"id":[0-9]*' | head -n1 | cut -d: -f2 || echo "")

    if [ -n "$NEW_CLAIM_ID" ] && [ "$NEW_CLAIM_ID" -gt 0 ]; then
        log_check "Submit Claim (POST /api/claims)" 0 "(Created Claim ID: ${NEW_CLAIM_ID})"

        # Approve claim
        APPROVE_RESPONSE=$(curl -s -X PATCH "${BASE_URL}/api/claims/${NEW_CLAIM_ID}" \
            -H "Content-Type: application/json" \
            -d '{"status":"approved"}' || echo "")

        if echo "$APPROVE_RESPONSE" | grep -q '"status":"approved"'; then
            log_check "Approve Claim (PATCH /api/claims/${NEW_CLAIM_ID})" 0 "(Status: approved)"
        else
            log_check "Approve Claim (PATCH /api/claims/${NEW_CLAIM_ID})" 1 "(Failed to approve)"
        fi
    else
        log_check "Submit Claim (POST /api/claims)" 1 "(Failed to submit claim)"
    fi
else
    log_check "Create Item (POST /api/items)" 1 "(Failed to create test item)"
fi

echo -e "\n${BLUE}======================================================${NC}"
echo -e "${BLUE}  Smoke Test Summary: ${PASSED_CHECKS}/${TOTAL_CHECKS} Passed${NC}"
echo -e "${BLUE}======================================================${NC}\n"

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}All smoke tests passed successfully! System is production-ready.${NC}\n"
    exit 0
else
    echo -e "${RED}One or more smoke tests failed. Check container logs.${NC}\n"
    exit 1
fi
