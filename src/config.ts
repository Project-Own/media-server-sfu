import { RtpCodecCapability } from "mediasoup/node/lib/RtpParameters";
require("dotenv").config();

type Router = {
  mediaCodecs: RtpCodecCapability[];
};
type Mediasoup = {
  router: Router;
  worker: any;
  webRtcTransport: {
    listenIps: { ip: string; announcedIp: string | undefined }[];
    initialAvailableOutgoingBitrate: number;
  };
};
type Config = {
  httpIp: string;
  httpPort: number;
  httpPeerStale: number;
  sslCrt: string;
  sslKey: string;
  mediasoup: Mediasoup;
};
const config: Config = {
  // http server ip, port, and peer timeout constant
  //
  httpIp: process.env.PRIVATE_IP || "0.0.0.0",
  httpPort: parseInt(process.env.PORT || "3000"),
  httpPeerStale: 15000,

  // ssl certs. we'll start as http instead of https if we don't have
  // these
  sslCrt: "../keys/ssl.crt",
  sslKey: "../keys/ssl.key",

  mediasoup: {
    worker: {
      rtcMinPort: 40000,
      rtcMaxPort: 40200,
      logLevel: "debug",
      logTags: [
        "info",
        "ice",
        "dtls",
        "rtp",
        "srtp",
        "rtcp",
        // 'rtx',
        // 'bwe',
        // 'score',
        // 'simulcast',
        // 'svc'
      ],
    },
    router: {
      mediaCodecs: [
        {
          kind: "audio",
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        },
        {
          kind: "video",
          mimeType: "video/VP8",
          clockRate: 90000,
          parameters: {
            //                'x-google-start-bitrate': 1000
          },
        },
        {
          kind: "video",
          mimeType: "video/h264",
          clockRate: 90000,
          parameters: {
            "packetization-mode": 1,
            "profile-level-id": "4d0032",
            "level-asymmetry-allowed": 1,
            //						  'x-google-start-bitrate'  : 1000
          },
        },
        {
          kind: "video",
          mimeType: "video/h264",
          clockRate: 90000,
          parameters: {
            "packetization-mode": 1,
            "profile-level-id": "42e01f",
            "level-asymmetry-allowed": 1,
            //						  'x-google-start-bitrate'  : 1000
          },
        },
      ],
    },

    // rtp listenIps are the most important thing, below. you'll need
    // to set these appropriately for your network for the demo to
    // run anywhere but on localhost
    webRtcTransport: {
      listenIps: [
        { ip: process.env.PRIVATE_IP ||  "0.0.0.0", announcedIp: process.env.PUBLIC_IP || "127.0.0.1" },
        // { ip: "192.168.42.68", announcedIp: null },
        // { ip: '10.10.23.101', announcedIp: null },
      ],
      initialAvailableOutgoingBitrate: 800000,
    },
  },
};

export default config;
