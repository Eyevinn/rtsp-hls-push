## Setup

Build container

```
docker build -t rtsphls:local
```

Start the container streaming video from RTSP server at 172.17.28.118, port 8554 and feed called `loop`:

```
docker run --rm -e RTSP=rtsp://172.17.28.118:8554/loop -p 8000:8000 rtsphls:local
```

Preview the HLS by pointing your browser to `http://localhost:8000/master.m3u8`

## Notes

```
docker run --rm -it -e RTSP_PROTOCOLS=tcp -p 8554:8554 aler9/rtsp-simple-server
```

```
ffmpeg -stream_loop -1 -re -i ~/Downloads/probably-the-best-10s.mp4 -f rtsp rtsp://127.0.0.1:8554/live
```

```
docker run --rm -e RTSP=rtsp://host.docker.internal:8554/beer -p 8000:8000 rtsphls:dev
```