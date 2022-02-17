const { spawn } = require("child_process");
const { access, constants, rmSync } = require("fs");
const fastify = require("fastify");
const { HLSPullPush, MediaPackageOutput } = require("@eyevinn/hls-pull-push");
const debug = require("debug")("rtsp2hls");

const { Logger } = require("./logger.js");

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

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
      if (opts.output) {
        this.output = opts.output;

        this.pullPushService = new HLSPullPush(new Logger());      
        const outputPlugin = new MediaPackageOutput();
        this.pullPushService.registerPlugin("mediapackage", outputPlugin);  
      }
    }
    this.rtspAddress = rtspAddress;
    this.hlsPort = (opts && opts.hlsPort) ? opts.hlsPort : 8000;
    this.fetcherApiPort = (opts && opts.fetcherApiPort) ? opts.fetcherApiPort : 8001;
    this.fetcherId = null;
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
        debug(`Process exited with code ${this.code}. Restarting process`);
        await this.stopPullPushProcess();
        this.cleanUpFiles();
        await sleep(2000); // grace period
        await this.startProcess();
        await this.startPullPushProcess();
      } else if (!this.process && !this.wantsToStop) {
        debug("Process stopped but should be running. Restarting process"); 
        await this.stopPullPushProcess();
        this.cleanUpFiles();
        await sleep(2000); // grace period
        await this.startProcess();
        await this.startPullPushProcess();
      }
    }, 5000);
    await this.startProcess();

    if (this.pullPushService) {
      await this.waitForHlsIsAvailable();
      this.pullPushService.listen(this.fetcherApiPort);

      await this.startPullPushProcess();
    }    
  }

  async restartPullPushProcess() {
    await this.stopPullPushProcess();
    await this.waitForHlsIsAvailable();
    await this.startPullPushProcess();
  }

  async startPullPushProcess() {
    const plugin = this.pullPushService.getPluginFor(this.output.type);
    let outputDest;
    if (this.output.type === "mediapackage") {
      outputDest = plugin.createOutputDestination({
        ingestUrls: [ {
          url: this.output.url,
          username: this.output.username,
          password: this.output.password,
        }]
      }, this.pullPushService.getLogger());
    }
    if (outputDest) {
      const source = new URL("http://localhost:8000/master.m3u8");
      const sessionId = this.pullPushService.startFetcher({
        name: "rtsp",
        url: source.href,
        destPlugin: outputDest,
        destPluginName: "mediapackage",
      });
      outputDest.attachSessionId(sessionId);
      this.fetcherId = sessionId;
    }
  }

  async stopPullPushProcess() {
    await this.pullPushService.stopFetcher(this.fetcherId);
    this.fetcherId = null;
  }

  async startProcess() {
    this.wantsToStop = false;
    this.code = 0;
    this.process = spawn("ffmpeg", [ "-y", "-fflags", "nobuffer", "-rtsp_transport", "tcp", 
      "-i", this.rtspAddress, "-max_muxing_queue_size", "1024", 
      "-filter_complex", "[0:v]split=3[v1][v2][v3];[v1]copy[v1out];[v2]scale=w=1280:h=720[v2out];[v3]scale=w=640:h=360[v3out]",
      "-map", "[v1out]", "-c:v:0", "libx264", "-x264-params", "nal-hrd=cbr:force-cfr=1", 
        "-b:v:0", "5M", "-maxrate:v:0", "5M", "-minrate:v:0", "5M", "-bufsize:v:0", "10M", 
        "-preset", "ultrafast", "-g", "48", "-sc_threshold", "0", "-keyint_min", "48",
      "-map", "[v2out]", "-c:v:1", "libx264", "-x264-params", "nal-hrd=cbr:force-cfr=1", 
        "-b:v:1", "3M", "-maxrate:v:1", "3M", "-minrate:v:1", "3M", "-bufsize:v:1", "3M", 
        "-preset", "ultrafast", "-g", "48", "-sc_threshold", "0", "-keyint_min", "48",
      "-map", "[v3out]", "-c:v:2", "libx264", "-x264-params", "nal-hrd=cbr:force-cfr=1", 
        "-b:v:2", "1M", "-maxrate:v:2", "1M", "-minrate:v:2", "1M", "-bufsize:v:2", "1M", 
        "-preset", "ultrafast", "-g", "48", "-sc_threshold", "0", "-keyint_min", "48",
      "-map", "a:0", "-c:a:0", "aac", "-b:a:0", "256k", "-ar", "48000", "-ac", "2",
      "-map", "a:0", "-c:a:1", "aac", "-b:a:1", "128k", "-ar", "48000", "-ac", "2",
      "-map", "a:0", "-c:a:2", "aac", "-b:a:2", "128k", "-ar", "48000", "-ac", "2",

      "-f", "hls", "-hls_time", "10", "-hls_flags", "independent_segments+delete_segments", "-hls_segment_type", "mpegts",
        "-hls_segment_filename", "/media/hls/master_%v_%02d.ts",
        "-hls_list_size", "6",
        "-master_pl_name", "master.m3u8",
        "-var_stream_map", "v:0,a:0 v:1,a:1 v:2,a:2", "/media/hls/master_%v.m3u8"
 ]);

    this.process.stdout.on("data", data => { debug(`${data}`); });
    this.process.stderr.on("data", data => { debug(`${data}`); });
    this.process.on("exit", code => {
      debug("Process exit with code " + code);
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
      this.wantsToStop = true;
      this.process.kill("SIGKILL");
      await waitForKilled();
    }
  }

  cleanUpFiles() {
    debug("Cleaning up files");
    rmSync("/media/hls/master*.m3u8", { force: true });
  }

  waitForHlsIsAvailable() {
    return new Promise((resolve, reject) => {
      let t = setInterval(() => {
        const file = "/media/hls/master.m3u8";
        access(file, constants.F_OK, (err) => {
          if (!err) {
            clearInterval(t);
            resolve();
          } else {
            debug(`${file} ${err}`);
          }
        });
      }, 1000);
    });
  }
  
}

module.exports = { RTSP2HLS };
