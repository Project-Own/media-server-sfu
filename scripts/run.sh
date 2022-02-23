#!/bin/bash

cat > /home/ubuntu/media-soup-sfu/.env<<EOF
PORT=3000
PUBLIC_IP="$(curl http://169.254.169.254/latest/meta-data/public-ipv4)"
PRIVATE_IP="$(curl http://169.254.169.254/latest/meta-data/local-ipv4)"
EOF

cd /home/ubuntu/media-soup-sfu
cat .env

forever start ./dist/app.js
