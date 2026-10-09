#!/bin/zsh
# contact.sh video.mp4 out.png [cols] [rows] — evenly spaced frames tiled into one image
v=$1; out=$2; c=${3:-4}; r=${4:-3}
dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$v")
n=$((c*r))
ffmpeg -loglevel error -y -i "$v" -vf "fps=$n/$dur,scale=480:-1,tile=${c}x${r}:padding=4" -frames:v 1 "$out"
