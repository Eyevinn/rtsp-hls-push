require('dotenv').config();

const { RTSP2HLS } = require("./src/engine.js");

const rtspAddress = process.env.RTSP || "rtsp://127.0.0.1:8554/live";

const run = async () => {
  try {
    let opts;
    if (process.env.MEDIAPACKAGE_URL) {
      opts = {
        output: {
          type: "mediapackage",
          url: process.env.MEDIAPACKAGE_URL,
          username: process.env.MEDIAPACKAGE_USERNAME,
          password: process.env.MEDIAPACKAGE_PASSWORD,
        }
      };
    }
    const server = new RTSP2HLS(rtspAddress, opts);
    await server.http();
    await server.start();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();