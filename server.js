const { RTSP2HLS } = require("./src/engine.js");

const rtspAddress = process.env.RTSP || "rtsp://127.0.0.1:8554/live";

const run = async () => {
  try {
    const server = new RTSP2HLS(rtspAddress);
    await server.http();
    await server.start();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();