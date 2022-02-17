import express, { Application } from "express";

import fs from "fs";
import { createWorker } from "mediasoup";
import { AudioLevelObserver } from "mediasoup/node/lib/AudioLevelObserver";
import { Consumer } from "mediasoup/node/lib/Consumer";
import { Producer } from "mediasoup/node/lib/Producer";
import { Router } from "mediasoup/node/lib/Router";
import { Transport } from "mediasoup/node/lib/Transport";
import { Worker } from "mediasoup/node/lib/Worker";
import path from "path";
import { Server, Socket } from "socket.io";

import config from "./config";
const https: any = require("httpolyglot");

const app: Application = express();

app.get("*", (req, res, next) => {
  const path = "/sfu/";

  if (req.path.indexOf(path) == 0 && req.path.length > path.length) {
    return next();
  }

  res.send(
    `You need to specify a room name in the path e.g. 'https://127.0.0.1/sfu/room'`
  );
});

app.use("/sfu/:room", express.static(path.join(__dirname, "../public")));

const credentials = {
  // key: fs.readFileSync(path.resolve(__dirname,"../keys/key.pem")),
  // cert: fs.readFileSync(path.resolve(__dirname, "../keys/key-cert.pem")),

  key: fs.readFileSync(path.resolve(__dirname, config.sslKey)),
  cert: fs.readFileSync(path.resolve(__dirname, config.sslCrt)),
};
const httpsServer = https.createServer(credentials, app);

httpsServer.listen(config.httpPort, config.httpIp, () => {
  console.log(
    `https server is running and listening on ` +
      `https://${config.httpIp}:${config.httpPort}`
  );
});

const io = new Server(httpsServer, {
  cors: {
    origin: [
      "http://localhost:3001",
      "http://localhost:3000",
      "https://project-own.github.io",
    ],
    methods: ["GET", "POST"],
  },
});

const connections = io.of("/mediasoup");

// connections.on("connection", async (socket) => {
//   console.log(socket.id);
// });

let worker: Worker;
const rooms: {
  [key: string]: {
    peers: string[];
    router: Router;
    audioLevelObserver: AudioLevelObserver;
    activeSpeaker: {
      producerId: string | null;
      volume: number | null;
      peerId: string | null;
    };
  };
} = {};
const peers: {
  [key: string]: {
    socket: Socket;
    roomName: string; // Name for the Router this Peer joined
    transports: string[];
    producers: string[];
    consumers: string[];
    peerDetails: {
      name: string;
      isAdmin: boolean; // Is this Peer the Admin?
    };
  };
} = {};
let transports: {
  socketId: string;
  transport: Transport;
  roomName: string;
  consumer: Consumer;
}[] = [];
let producers: { socketId: string; producer: Producer; roomName: string }[] =
  [];
let consumers: { socketId: string; consumer: Consumer; roomName: string }[] =
  [];

const createMediasoupWorker = async () => {
  worker = await createWorker({
    logLevel: config.mediasoup.worker.logLevel,
    logTags: config.mediasoup.worker.logTags,
    rtcMinPort: config.mediasoup.worker.rtcMinPort,
    rtcMaxPort: config.mediasoup.worker.rtcMaxPort,
  });
  console.log(`worker pid ${worker.pid}`);

  worker.on("died", (error) => {
    console.log("worker has died");
    setTimeout(() => process.exit(1), 2000); // exit in 2 seconds
  });
};

createMediasoupWorker();

connections.on("connection", async (socket) => {
  console.log("New Socket Joined: ", socket.id);

  socket.emit("connection-success", {
    socketId: socket.id,
  });
  socket.on("getPeers", (callback) => {
    let details: { [key: string]: { isAdmin: boolean; name: string } } = {};

    try {
      const roomPeers = rooms[peers[socket.id].roomName].peers;
      const filteredDetails = roomPeers.filter((peer) => {
        return peer !== socket.id;
      });

      if (filteredDetails)
        filteredDetails.forEach((peer) => {
          if (peers[peer]) details[peer] = peers[peer].peerDetails;
        });
    } catch (e) {}

    // console.log(details);

    callback(details);
  });

  socket.on("joinRoom", async ({ roomName, name }, callback) => {
    const router1 = await createRoom(roomName, socket.id);
    await socket.join(roomName);

    peers[socket.id] = {
      socket,
      roomName, // Name for the Router this Peer joined
      transports: [],
      producers: [],
      consumers: [],
      peerDetails: {
        name: name,
        isAdmin: false, // Is this Peer the Admin?
      },
    };
    const rtpCapabilities = router1.rtpCapabilities;
    // console.log("Router RTP capabilites", rtpCapabilities)
    // call callback from the client and send back the rtpCapabilities
    callback({ rtpCapabilities });
  });

  const createRoom = async (roomName: string, socketId: string) => {
    let router1;
    let roomPeers: string[] = [];
    let audioLevelObserver: AudioLevelObserver;
    let activeSpeaker: {
      volume: number | null;
      producerId: string | null;
      peerId: string | null;
    };

    if (rooms[roomName]) {
      console.log("Created Room: ", roomName);

      router1 = rooms[roomName].router;
      roomPeers = rooms[roomName].peers ?? [];
      audioLevelObserver = rooms[roomName].audioLevelObserver;
      activeSpeaker = rooms[roomName].activeSpeaker;
    } else {
      console.log("Joined Room: ", roomName);

      router1 = await worker.createRouter({
        mediaCodecs: config.mediasoup.router.mediaCodecs,
      });
      // audioLevelObserver for signaling active speaker
      audioLevelObserver = await router1.createAudioLevelObserver({
        interval: 800,
      });
      audioLevelObserver.on("volumes", (volumes) => {
        const { producer, volume } = volumes[0];
        // console.log(
        //   "audio-level volumes event",
        //   roomName,
        //   producer.appData.socketId,
        //   volume
        // );
        if (
          rooms[roomName].activeSpeaker.peerId !== producer.appData.socketId &&
          rooms[roomName].activeSpeaker.producerId !== producer.id
        ) {
          rooms[roomName].activeSpeaker.producerId = producer.id;
          rooms[roomName].activeSpeaker.peerId = producer.appData.socketId;

          const peerId = rooms[roomName].peers[0];
          peers[peerId].socket.broadcast.to(roomName).emit("active-speaker", {
            activeSpeaker: rooms[roomName].activeSpeaker,
          });
          peers[peerId].socket.emit("active-speaker", {
            activeSpeaker: rooms[roomName].activeSpeaker,
          });
        }
        rooms[roomName].activeSpeaker.volume = volume;

        // io.emit("active-speaker", {
        //   activeSpeaker: rooms[roomName].activeSpeaker,
        // });
      });
      audioLevelObserver.on("silence", () => {
        // console.log("audio-level silence event", roomName);

        if (rooms[roomName].activeSpeaker.peerId !== null) {
          rooms[roomName].activeSpeaker.producerId = null;
          rooms[roomName].activeSpeaker.volume = null;
          rooms[roomName].activeSpeaker.peerId = null;

          const peerId = rooms[roomName].peers[0];
          peers[peerId].socket.broadcast.to(roomName).emit("active-speaker", {
            activeSpeaker: rooms[roomName].activeSpeaker,
          });
          peers[peerId].socket.emit("active-speaker", {
            activeSpeaker: rooms[roomName].activeSpeaker,
          });
        }

        // io.emit("active-speaker", {
        //   activeSpeaker: rooms[roomName].activeSpeaker,
        // });
      });

      activeSpeaker = {
        volume: null,
        peerId: null,
        producerId: null,
      };
    }

    console.log(`Router Created, ID: ${router1.id}`, roomPeers.length);

    rooms[roomName] = {
      router: router1,
      peers: [...roomPeers, socketId],
      audioLevelObserver: audioLevelObserver,
      activeSpeaker: activeSpeaker,
    };

    return router1;
  };

  const removeItems = (items: any, socketId: string, type: string) => {
    items.forEach((item: any) => {
      if (item.socketId === socketId) {
        item[type].close();
      }
    });
    items = items.filter((item: any) => item.socketId !== socket.id);

    return items;
  };

  socket.on("disconnect", async () => {
    // client disconnects
    console.log("Peer disconnected: ", socket.id);
    consumers = removeItems(consumers, socket.id, "consumer");
    producers = removeItems(producers, socket.id, "producer");
    transports = removeItems(transports, socket.id, "transport");

    const { roomName } = peers[socket.id];
    await socket.leave(roomName);

    // console.log(roomName);
    delete peers[socket.id];

    rooms[roomName] = {
      ...rooms[roomName],
      router: rooms[roomName].router,
      peers: rooms[roomName].peers.filter((socketId) => socketId !== socket.id),
    };
  });

  socket.on("createWebRtcTransport", async ({ consumer }, callback) => {
    const roomName = peers[socket.id].roomName;
    const router = rooms[roomName].router;

    const transport = await createWebRtcTransport(router);
    callback({
      params: {
        id: transport?.id,
        iceParameters: transport?.iceParameters,
        iceCandidates: transport?.iceCandidates,
        dtlsParameters: transport?.dtlsParameters,
      },
    });

    addTransport(transport!, roomName, consumer);
  });

  const addTransport = (
    transport: Transport,
    roomName: string,
    consumer: Consumer
  ) => {
    transports = [
      ...transports,
      { socketId: socket.id, transport, roomName, consumer },
    ];

    peers[socket.id] = {
      ...peers[socket.id],
      transports: [...peers[socket.id].transports, transport.id],
    };
  };

  const getTransport = (socketId: string) => {
    const [producerTransport] = transports.filter(
      (transport) => transport.socketId === socketId && !transport.consumer
    );
    return producerTransport.transport;
  };

  socket.on("transport-connect", ({ dtlsParameters }) => {
    // console.log("DTLS parameters", { dtlsParameters });
    getTransport(socket.id).connect({ dtlsParameters });
  });

  const addProducer = (producer: Producer, roomName: string) => {
    producers = [...producers, { socketId: socket.id, producer, roomName }];

    peers[socket.id] = {
      ...peers[socket.id],
      producers: [...peers[socket.id].producers, producer.id],
    };
  };

  const informConsumers = (
    roomName: string,
    socketId: string,
    id: string,
    appData: any
  ) => {
    console.log(`Just joined, id ${id} ${roomName}, ${socketId}`);

    peers[socketId].socket.broadcast.to(roomName).emit("new-producer", {
      id: id,
      appData: appData,
    });
    // A new producer just joined
    // let all consumers to consume this producer
    // producers.forEach((producerData) => {
    //   if (
    //     producerData.socketId !== socketId &&
    //     producerData.roomName === roomName
    //   ) {
    //     const producerSocket = peers[producerData.socketId].socket;
    //     // use socket to send producer id to producer
    //     console.log("App Data: ", producerData.producer.appData);
    //     producerSocket.emit("new-producer", {
    //       id: id,
    //       appData: producerData.producer.appData,
    //     });
    //   }
    // });
  };

  socket.on("getProducers", (callback) => {
    const { roomName } = peers[socket.id];

    let producerList: {
      id: string;
      appData: any;
    }[] = [];
    producers.forEach((producerData) => {
      if (
        producerData.socketId !== socket.id &&
        producerData.roomName === roomName
      ) {
        producerList = [
          ...producerList,
          {
            id: producerData.producer.id,
            appData: producerData.producer.appData,
          },
        ];
      }
    });

    // return the producer list back to the client
    callback(producerList);
  });

  socket.on(
    "transport-produce",
    async ({ kind, rtpParameters, appData }, callback) => {
      const producer = await getTransport(socket.id).produce({
        kind,
        rtpParameters,
        appData,
      });

      const { roomName } = peers[socket.id];

      addProducer(producer, roomName);

      // Inform Consumer about new producer
      informConsumers(roomName, socket.id, producer.id, appData);

      // monitor audio level of this producer. we call addProducer() here,
      // but we don't ever need to call removeProducer() because the core
      // AudioLevelObserver code automatically removes closed producers
      if (producer.kind === "audio") {
        rooms[roomName].audioLevelObserver.addProducer({
          producerId: producer.id,
        });
      }

      console.log(
        "Producer id: ",
        socket.id,
        producer.id,
        producer.kind,
        producer.appData
      );

      producer.on("transportclose", () => {
        // console.log("transport for this producer closed ");
        producer.close();
      });

      callback({
        id: producer.id,
        producersExist: producers.length > 1 ? true : false,
      });
    }
  );

  socket.on(
    "transport-recv-connect",
    async ({ dtlsParameters, serverConsumerTransportId }) => {
      // console.log("DTLS parameters", { dtlsParameters });
      const consumerTransport = transports.find(
        (transportData) =>
          transportData.consumer &&
          transportData.transport.id == serverConsumerTransportId
      )?.transport;
      await consumerTransport?.connect({ dtlsParameters });
    }
  );

  const addConsumer = (
    consumer: Consumer,
    roomName: string,
    socketId: string
  ) => {
    consumers = [...consumers, { socketId, consumer, roomName }];

    peers[socket.id] = {
      ...peers[socket.id],
      consumers: [...peers[socket.id].consumers, consumer.id],
    };
  };

  socket.on(
    "consume",
    async (
      { rtpCapabilities, remoteProducerId, serverConsumerTransportId, appData },
      callback
    ) => {
      try {
        const { roomName } = peers[socket.id];
        const router = rooms[roomName].router;

        const consumerTransport = transports.find(
          (transportData) =>
            transportData.consumer &&
            transportData.transport.id == serverConsumerTransportId
        )?.transport;

        if (
          router.canConsume({
            producerId: remoteProducerId,
            rtpCapabilities,
          })
        ) {
          const consumer = await consumerTransport?.consume({
            producerId: remoteProducerId,
            rtpCapabilities,
            paused: true,
            appData,
          });

          consumer?.on("transportclose", () => {
            // console.log("transport close from consumer");
          });

          consumer?.on("producerclose", () => {
            // console.log("producer of consumer closed");
            socket.emit("producer-closed", { remoteProducerId });

            consumerTransport?.close();
            transports = transports.filter(
              (transportData) =>
                transportData.transport.id !== consumerTransport?.id
            );
            consumer.close();
            consumers = consumers.filter(
              (consumerData) => consumerData.consumer.id !== consumer.id
            );
          });

          if (consumer) addConsumer(consumer, roomName, socket.id);

          const params = {
            id: consumer?.id,
            producerId: remoteProducerId,
            kind: consumer?.kind,
            rtpParameters: consumer?.rtpParameters,
            serverConsumerId: consumer?.id,
            producerAppData: appData,
          };

          callback({ params });
        }
      } catch (error: any) {
        // console.log(error.message);
        callback({
          params: {
            error: error,
          },
        });
      }
    }
  );

  socket.on("consumer-resume", async ({ serverConsumerId }) => {
    // console.log("Consumer resume");
    const consumer = consumers.find(
      (consumerData) => consumerData.consumer.id === serverConsumerId
    )?.consumer;

    await consumer?.resume();
  });
});

const createWebRtcTransport = async (router: Router) => {
  try {
    const { listenIps, initialAvailableOutgoingBitrate } =
      config.mediasoup.webRtcTransport;
    const webRtcTransportOptions = {
      listenIps,
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      initialAvailableOutgoingBitrate,
    };

    const transport = await router.createWebRtcTransport(
      webRtcTransportOptions
    );
    // console.log(`transport id: ${transport.id}`);

    transport.on("dtlsstatechange", (dtlsState) => {
      if (dtlsState === "closed") {
        transport.close();
      }
    });

    transport.on("close", () => {
      // console.log("transport closed");
    });

    // resolve(transport);
    return transport;
  } catch (error) {
    // reject(error);
  }
};
