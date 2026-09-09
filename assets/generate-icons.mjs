import assert from "node:assert/strict";
import fs from "node:fs";
import { deflateSync } from "node:zlib";

const source = fs.readFileSync(new URL("./icon.svg", import.meta.url), "utf8");
assert.match(source, /viewBox="0 0 20 20"/);
const shapes = [...source.matchAll(/<(rect|polyline)\s+([^>]+)\/>/g)].map(([, kind, attributes]) => {
    const values = Object.fromEntries([...attributes.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, key, value]) => [key, value]));
    const hex = kind === "rect" ? values.fill : values.stroke;
    assert.match(hex, /^#[\da-f]{6}$/i);
    const color = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
    if (kind === "rect") {
        return { kind, color, x: +values.x, y: +values.y, width: +values.width, height: +values.height, radius: +(values.rx ?? 0) };
    }
    assert.equal(values["stroke-linecap"], "round");
    assert.equal(values["stroke-linejoin"], "round");
    return { kind, color, radius: +values["stroke-width"] / 2, points: values.points.split(/\s+/).map(point => point.split(",").map(Number)) };
});
assert.equal(shapes.length, 6, "Update the limited rasterizer if the SVG shape set changes.");

function contains(shape, x, y) {
    if (shape.kind === "rect") {
        if (x < shape.x || y < shape.y || x > shape.x + shape.width || y > shape.y + shape.height) return false;
        const nearestX = Math.max(shape.x + shape.radius, Math.min(shape.x + shape.width - shape.radius, x));
        const nearestY = Math.max(shape.y + shape.radius, Math.min(shape.y + shape.height - shape.radius, y));
        return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= shape.radius ** 2;
    }
    return shape.points.slice(1).some(([bx, by], index) => {
        const [ax, ay] = shape.points[index];
        const dx = bx - ax;
        const dy = by - ay;
        const position = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
        return (x - ax - position * dx) ** 2 + (y - ay - position * dy) ** 2 <= shape.radius ** 2;
    });
}

function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
    const tag = Buffer.from(type, "ascii");
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(Buffer.concat([tag, data])));
    return Buffer.concat([length, tag, data, checksum]);
}

function rasterize(size) {
    const samples = 8;
    const stride = 1 + size * 4;
    const rows = Buffer.alloc(size * stride);
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const sum = [0, 0, 0];
            let covered = 0;
            for (let sy = 0; sy < samples; sy++) {
                for (let sx = 0; sx < samples; sx++) {
                    const px = (x + (sx + 0.5) / samples) * 20 / size;
                    const py = (y + (sy + 0.5) / samples) * 20 / size;
                    let top;
                    for (const shape of shapes) if (contains(shape, px, py)) top = shape;
                    if (top) {
                        covered++;
                        top.color.forEach((channel, index) => { sum[index] += channel; });
                    }
                }
            }
            const offset = y * stride + 1 + x * 4;
            sum.forEach((channel, index) => { rows[offset + index] = covered ? Math.round(channel / covered) : 0; });
            rows[offset + 3] = Math.round(255 * covered / (samples * samples));
        }
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 8;
    header[9] = 6;
    return Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk("IHDR", header),
        chunk("IDAT", deflateSync(rows, { level: 9 })),
        chunk("IEND", Buffer.alloc(0))
    ]);
}

for (const [filename, size] of [["icon.png", 20], ["icon-128.png", 128], ["icon-300.png", 300]]) {
    const bytes = rasterize(size);
    fs.writeFileSync(new URL(`./${filename}`, import.meta.url), bytes);
    console.log(`Wrote ${filename}: ${size} x ${size}, RGBA PNG, CRC32 0x${crc32(bytes).toString(16).padStart(8, "0")}`);
}
