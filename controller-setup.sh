#!/bin/bash
# ============================================
# Gzad Controller Setup Script
# ============================================
# Run these commands while connected to the controller's WiFi hotspot (192.168.43.1)
# Or replace the IP with the controller's LAN IP if on the same network.
#
# IMPORTANT: Replace YOUR_DOMAIN with your actual Vercel deployment URL
# e.g., https://gzadge.vercel.app
# ============================================

CONTROLLER_IP="192.168.43.1"
CONTROLLER_PORT="2016"
YOUR_DOMAIN="https://YOUR-DOMAIN-HERE.vercel.app"
DEVICE_ID="y1c-825-61009"

echo "=== Gzad Controller Setup ==="
echo "Controller: $CONTROLLER_IP:$CONTROLLER_PORT"
echo "Callback URL: $YOUR_DOMAIN"
echo ""

# 1. Set play log callback URL
# The controller will POST play logs (with GPS) to this URL every 1 minute
echo "--- Setting play log callback URL ---"
curl -X POST "http://$CONTROLLER_IP:$CONTROLLER_PORT/settings" \
  -H "Content-Type: application/json" \
  -d "{
    \"_id\": \"setup-playlog-1\",
    \"_type\": \"setUploadLogUrl\",
    \"uploadurl\": \"$YOUR_DOMAIN/api/callback/playlog?device=$DEVICE_ID\",
    \"interval\": 1
  }"
echo ""
echo ""

# 2. Set GPS subscription
# The controller will POST GPS position every 30 seconds
echo "--- Setting GPS callback URL ---"
curl -X POST "http://$CONTROLLER_IP:$CONTROLLER_PORT/settings" \
  -H "Content-Type: application/json" \
  -d "{
    \"_id\": \"setup-gps-1\",
    \"_type\": \"setSubGPS\",
    \"openSub\": true,
    \"endpoint\": \"$YOUR_DOMAIN/api/callback/gps?device=$DEVICE_ID\",
    \"interval\": 30,
    \"mode\": \"http\"
  }"
echo ""
echo ""

# 3. Verify settings
echo "--- Verifying play log URL ---"
curl -X POST "http://$CONTROLLER_IP:$CONTROLLER_PORT/settings" \
  -H "Content-Type: application/json" \
  -d '{"_id":"verify-1","_type":"getUploadLogUrl"}'
echo ""
echo ""

echo "--- Verifying GPS subscription ---"
curl -X POST "http://$CONTROLLER_IP:$CONTROLLER_PORT/settings" \
  -H "Content-Type: application/json" \
  -d '{"_id":"verify-2","_type":"getSubGPS"}'
echo ""
echo ""

echo "=== Setup Complete ==="
echo "The controller will now send:"
echo "  - Play logs every 1 minute to $YOUR_DOMAIN/api/callback/playlog"
echo "  - GPS position every 30 seconds to $YOUR_DOMAIN/api/callback/gps"
echo ""
echo "IMPORTANT: The controller stays connected to vehhub.top for ad management."
echo "These callbacks are ADDITIONAL - they don't replace the vehhub connection."
