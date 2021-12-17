```
docker run --rm -it -e RTSP_PROTOCOLS=tcp -p 8554:8554 aler9/rtsp-simple-server
```

```
ffmpeg -stream_loop -1 -re -i ~/Downloads/probably-the-best-10s.mp4 -f rtsp rtsp://127.0.0.1:8554/live
```

```
docker run --rm -e RTSP=rtsp://host.docker.internal:8554/beer -p 8000:8000 rtsphls:dev
```