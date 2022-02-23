#!/bin/bash
sudo apt-get update 
sudo apt upgrade -y
sudo  apt-get install  --fix-missing -y   build-essential pip net-tools iputils-ping iproute2 curl
curl -sL https://deb.nodesource.com/setup_17.x | sudo -E bash -
sudo apt install nodejs

curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
sudo apt install yarn


sudo npm install -g forever

