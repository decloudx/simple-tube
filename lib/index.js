const fs = require("fs");
const stream = require("stream");
const ytdlCore = require("@distube/ytdl-core");
const yts = require("yt-search");
const NodeFFmpegApi = require("simple-node-ffmpeg-api");

exports.makeDownloadAudio = function (url, format) {
    const outputStream = new stream.PassThrough();
    const inputStream = ytdlCore(url, { quality: 140 });
    if (format.ffmpegAudioOptions.length) {
        const tmpFile = createTempFile(format.fileExtension);
        new NodeFFmpegApi()
            .makeInput(inputStream)
            .makeOutputOptions(format.ffmpegAudioOptions)
            .makeOutput(tmpFile.path)
            .on("close", (code) => {
                if (code) tmpFile.unlink();
                else {
                    fs.createReadStream(tmpFile.path)
                        .pipe(outputStream)
                        .on("error", tmpFile.unlink)
                        .on("finish", tmpFile.unlink);
                }
            })
            .on("error", (error) => outputStream.emit("error", error))
            .run();
        return outputStream;
    } else {
        inputStream.pipe(outputStream);
        return outputStream;
    }
};

exports.makeDownloadVideo = function (url, quality) {
    const tmpFile = createTempFile("mp4");
    const outputStream = new stream.PassThrough();
    const inputAudioStream = ytdlCore(url, { quality: 140 });
    const inputVideoStream = ytdlCore(url, { quality });
    new NodeFFmpegApi()
        .makeInput(inputAudioStream)
        .makeInput(inputVideoStream)
        .makeOutputOptions(["-c:a", "copy", "-c:v", "copy"])
        .makeOutput(tmpFile.path)
        .on("close", (code) => {
            if (code) tmpFile.unlink();
            else {
                fs.createReadStream(tmpFile.path)
                    .pipe(outputStream)
                    .on("error", tmpFile.unlink)
                    .on("finish", tmpFile.unlink);
            }
        })
        .on("error", (error) => outputStream.emit("error", error))
        .run();
    return outputStream;
};

exports.makeSearchVideo = function (query, specific = false) {
    return new Promise((resolve, reject) => {
        if (specific) {
            if (ytdlCore.validateURL(query)) {
                yts({ videoId: ytdlCore.getVideoID(query) })
                    .then(resolve)
                    .catch(reject);
            } else {
                yts({ query })
                    .then(({ videos }) => resolve(videos[0]))
                    .catch(reject);
            }
        } else {
            yts({ query }).then(resolve).catch(reject);
        }
    });
};

exports.AUDIO_FORMAT = {
    AAC: {
        fileExtension: "m4a",
        ffmpegAudioOptions: []
    },
    WAV_PCM_ALAW: {
        fileExtension: "wav",
        ffmpegAudioOptions: ["-c:a", "pcm_alaw", "-ar", 48000]
    },
    WAV_PCM_S16LE: {
        fileExtension: "wav",
        ffmpegAudioOptions: ["-c:a", "pcm_s16le", "-ar", 48000]
    },
    FLAC: {
        fileExtension: "flac",
        ffmpegAudioOptions: ["-c:a", "flac", "-compression_level", 9, "-ar", 48000]
    },
    OGG_VORBIS: {
        fileExtension: "ogg",
        ffmpegAudioOptions: ["-c:a", "libvorbis", "-b:a", "128k", "-ar", 48000]
    },
    OPUS: {
        fileExtension: "opus",
        ffmpegAudioOptions: ["-c:a", "libopus", "-b:a", "128k", "-ar", 48000]
    },
    MP3: {
        fileExtension: "mp3",
        ffmpegAudioOptions: ["-c:a", "libmp3lame", "-b:a", "128k", "-ar", 48000]
    }
};

exports.VIDEO_QUALITY = {
    Q360P: 134,
    Q480P: 135,
    Q720P: 136,
    Q1080P: 137,
    Q240P: 133
};

exports.createTempFile = createTempFile;
function createTempFile(suffix) {
    const fs = require("fs");
    const path = require("util").format(
        "%s/%s.%s",
        require("os").tmpdir(),
        require("crypto").randomBytes(15).toString("hex"),
        suffix
    );
    return {
        unlink: () => fs.existsSync(path) && fs.unlinkSync(path),
        path
    };
}
