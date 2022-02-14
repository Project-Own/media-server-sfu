# Mediasoup-SFU MediaSever
## DevContainer
Run Docker

Open in Vscode DevContainer <br/>
<br>OR,</br>

docker-compose up<br/>
then attach container to vscode
## Run
<b>yarn</b> - to install node modules <br/>
<b>yarn start</b> - to compile ts to dist/*.js and start node server<br/>
<b>yarn dev</b> - to run nodemon with ts-node src/*.ts and develop in typescript<br/>
<b>yarn watch</b> - to run watchify watching public/index.js and create public/bundle.js <br/>

## Config
<b>File:</b> src/config.ts<br/>
<b>server location:</b> https://localhost:3000<br/>
3000 port for server connection<br/>
40000-40200 port for udp connection<br/>
