const { spawn } = require("child_process");
const fastify = require("fastify");
const debug = require("debug")("rtsp2hls");

class RTSP2HLS {
  constructor(rtspAddress, opts) {
    if (!rtspAddress) {
      throw new Error("No RTSP adress specified");
    }
    if (opts) {
      if (opts.username && opts.password) {
        this.rtspUsername = opts.username;
        this.rtspPassword = opts.password;
      }
    }
    this.rtspAddress = rtspAddress;
    this.hlsPort = (opts && opts.hlsPort) ? opts.hlsPort : 8000;
    this.hlsServer = fastify();
    this.hlsServer.register(require("fastify-static"), {
      root: "/media/hls",
      prefix: "/",
    });
    this.hlsServer.get("/health", async (request, reply) => {
      reply.send({
        message: "ok", 
        component: "rtsp2hls",
      });
    });
  }

  async http() {
    const address = await this.hlsServer.listen(this.hlsPort, '0.0.0.0');
    console.log(`Server listening on ${address}`);
  }

  async start() {
    const monitor = setInterval(async () => {
      if (!this.process && this.code > 0) {
        debug("Restarting process");
        await this.start();
      }
    }, 5000);
    await this.startProcess();
  }

  async startProcess() {
    this.code = 0;
    this.process = spawn("ffmpeg", [ "-fflags", "nobuffer", "-rtsp_transport", "tcp", 
      "-i", this.rtspAddress, 
      "-filter_complex", "[0:v]split=2[v1][v2];[v1]copy[v1out];[v2]scale=w=1280:h=720[v2out]",
      "-map", "[v1out]", "-c:v:0", "libx264", "-x264-params", "nal-hrd=cbr:force-cfr=1", 
        "-b:v:0", "5M", "-maxrate:v:0", "5M", "-minrate:v:0", "5M", "-bufsize:v:0", "10M", 
        "-preset", "ultrafast", "-g", "48", "-sc_threshold", "0", "-keyint_min", "48",
      "-map", "[v2out]", "-c:v:1", "libx264", "-x264-params", "nal-hrd=cbr:force-cfr=1", 
        "-b:v:1", "3M", "-maxrate:v:1", "3M", "-minrate:v:1", "3M", "-bufsize:v:1", "3M", 
        "-preset", "ultrafast", "-g", "48", "-sc_threshold", "0", "-keyint_min", "48",
      "-map", "a:0", "-c:a:0", "aac", "-b:a:0", "96k", "-ac", "2",
      "-map", "a:0", "-c:a:1", "aac", "-b:a:1", "96k", "-ac", "2",

      "-f", "hls", "-hls_time", "2", "-hls_flags", "independent_segments+delete_segments", "-hls_segment_type", "mpegts",
        "-hls_segment_filename", "/media/hls/master_%v_%02d.ts",
        "-hls_list_size", "3",
        "-master_pl_name", "master.m3u8",
        "-var_stream_map", "v:0,a:0 v:1,a:1", "/media/hls/master_%v.m3u8"
 ]);

    this.process.stdout.on("data", data => { debug(`${data}`); });
    this.process.stderr.on("data", data => { debug(`${data}`); });
    this.process.on("exit", code => {
      debug(this.process.spawnargs);
      this.process = null;
      this.code = code;
    });
  }

  async stop() {
    const waitForKilled = new Promise((resolve, reject) => {
      let t = setInterval(() => {
        if (!this.process) {
          clearInterval(t);
          resolve();
        }
      }, 1000);
    });
    if (this.process) {
      this.process.kill("SIGKILL");
      await waitForKilled();
    }
  }

}

module.exports = { RTSP2HLS };