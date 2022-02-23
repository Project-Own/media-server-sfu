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



# Production
Create AWS EC2 instance with Ubuntu Image


<ol>
  <li>Run "scripts/setup.sh" script to install necessary dependencies</li>
  <li>RUN "yarn" to install node_modules</li>
  <li>RUN "yarn start" or "tsc" to bundle ts-code to "dist" folder</li>
  <li>** Need to update .env file for PRIVATE_IP, PUBLIC_IP and PORT</li>
  <li>** "scripts/run.sh" updates .env file</li>
  <li>(Optional) Crontab for auto start dist/app.js on ec2 instance reboot/startup </li>
  <li>RUN "crontab -e" to open crontab editor</li>
  <li>Add "@reboot /home/ubuntu/media-soup-sfu/scripts/run.sh >> /home/ubuntu/cron.log"</li>
</ol>

