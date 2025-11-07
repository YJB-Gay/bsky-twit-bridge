import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';

const MAX_SIZE = 100 * 1024 * 1024
const MAX_DURATION = 180

export async function compressVideo(inputUrl: string, outputPath: string): Promise<string> {
    const axios = (await import('axios')).default
    const response = await axios.get(inputUrl, {
        responseType: 'arraybuffer',
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 60000
    })
    const tempInput = outputPath + '.input.mp4'
    fs.writeFileSync(tempInput, new Uint8Array(response.data))
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(tempInput, (err, metadata) => {
            if (err) {
                try { fs.unlinkSync(tempInput) } catch {}
                return reject(err)
            }
            const duration = metadata.format.duration || 0
            const trimDuration = Math.min(duration, MAX_DURATION)
            ffmpeg(tempInput)
                .outputOptions([
                    '-c:v libx264',
                    '-profile:v main',
                    '-level:v 4.0',
                    '-crf 23',
                    '-preset medium',
                    '-c:a aac',
                    '-b:a 128k',
                    '-ar 48000',
                    '-ac 2',
                    '-vf scale=\'min(1920,iw)\':\'min(1080,ih)\':force_original_aspect_ratio=decrease,format=yuv420p',
                    '-movflags +faststart',
                    '-max_muxing_queue_size 1024',
                    `-t ${trimDuration}`
                ])
                .output(outputPath)
                .on('end', () => {
                    try { fs.unlinkSync(tempInput) } catch {}
                    const stats = fs.statSync(outputPath)
                    if (stats.size > MAX_SIZE) {
                        fs.unlinkSync(outputPath)
                        fs.writeFileSync(tempInput, new Uint8Array(response.data))
                        ffmpeg(tempInput)
                            .outputOptions([
                                '-c:v libx264',
                                '-profile:v main',
                                '-crf 28',
                                '-preset fast',
                                '-c:a aac',
                                '-b:a 96k',
                                '-ar 48000',
                                '-ac 2',
                                '-vf scale=\'min(1280,iw)\':\'min(720,ih)\':force_original_aspect_ratio=decrease,format=yuv420p',
                                '-movflags +faststart',
                                `-t ${trimDuration}`
                            ])
                            .output(outputPath)
                            .on('end', () => {
                                try { fs.unlinkSync(tempInput) } catch {}
                                resolve(outputPath)
                            })
                            .on('error', (err) => {
                                try { fs.unlinkSync(tempInput) } catch {}
                                reject(err)
                            })
                            .run()
                    } else {
                        resolve(outputPath)
                    }
                })
                .on('error', (err) => {
                    try { fs.unlinkSync(tempInput) } catch {}
                    reject(err)
                })
                .run()
        })
    })
}

export function cleanupTempFiles(dir: string = './temp') {
    if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            try {
                fs.unlinkSync(path.join(dir, file));
            } catch {}
        }
    }
}
