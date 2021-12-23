Docker container that takes an RTSP video feed, transcode to HLS and push to AWS MediaPackage origin (optional).

Service based on [ffmpeg](https://ffmpeg.org) and the NPM library [@eyevinn/hls-pull-push](https://www.npmjs.com/package/@eyevinn/hls-pull-push)

## Usage

Assume a camera publishing a video feed to RTSP address `rtsp://<username>:<password>@10.0.0.10/stream1`.

```
docker run --rm -e RTSP=rtsp://<username>:<password>@10.0.0.10/stream1 \
  -p 8000:8000 eyevinntechnology/rtsphls:<version>
```

Then you would have access to the HLS on `http://localhost:8000/master.m3u8`

### Push to AWS MediaPackage origin

If you wish to also push the HLS to an AWS MediaPackage origin start the container with the following options added:

```
docker run --rm -e RTSP=rtsp://<username>:<password>@10.0.0.10/stream1 \ 
  -e MEDIAPACKAGE_URL=<ingesturl> \
  -e MEDIAPACKAGE_USERNAME=<username> \
  -e MEDIAPACKAGE_PASSWORD=<password> \
  -p 8000:8000 eyevinntechnology/rtsphls:<version>
```

# About Eyevinn Technology

Eyevinn Technology is an independent consultant firm specialized in video and streaming. Independent in a way that we are not commercially tied to any platform or technology vendor.

At Eyevinn, every software developer consultant has a dedicated budget reserved for open source development and contribution to the open source community. This give us room for innovation, team building and personal competence development. And also gives us as a company a way to contribute back to the open source community.

Want to know more about Eyevinn and how it is to work here. Contact us at work@eyevinn.se!