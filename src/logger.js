const debug = require("debug")("rtsp2hls");

class Logger {
  constructor() {

  }

  info(message) {
    console.log(message);
  }

  verbose(message) {
    debug(message);
  }

  error(message) {
    console.error(message);
  }
}

module.exports = { Logger };