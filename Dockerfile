ARG VARIANT="16-bullseye"
FROM mcr.microsoft.com/vscode/devcontainers/typescript-node:0-${VARIANT}

RUN apt-get update -y
RUN apt upgrade -y
RUN apt-get install  --fix-missing -y   build-essential pip net-tools iputils-ping iproute2 curl
   
# RUN curl -fsSL https://deb.nodesource.com/setup_16.x | bash -
# RUN apt-get install nodejs   --fix-missing -y

EXPOSE 3000
EXPOSE 40000-40200

