import fs from 'fs';
import { IEnvelope } from 'ginkgoch-geom';
import { BufferWriter } from 'ginkgoch-buffer-io';

export default class ShpHeader {
    fileCode: number = 9994;
    fileLength: number = 100;
    version: number = 1000;
    fileType: number = 5;
    minx: number = Number.POSITIVE_INFINITY;
    miny: number = Number.POSITIVE_INFINITY;
    maxx: number = Number.NEGATIVE_INFINITY;
    maxy: number = Number.NEGATIVE_INFINITY;

    get envelope(): IEnvelope { 
        return { 
            minx: this.minx, 
            miny: this.miny, 
            maxx: this.maxx, 
            maxy: this.maxy 
        };
    }

    set envelope(envelope: IEnvelope) {
        this.minx = envelope.minx;
        this.miny = envelope.miny;
        this.maxx = envelope.maxx;
        this.maxy = envelope.maxy;
    }

    static read(fd: number): ShpHeader {
        const buff = Buffer.alloc(68);
        fs.readSync(fd, buff, 0, buff.length, 0);
        const header = ShpHeader._read(buff);
        return header;
    }

    write(fd: number) {
        const buff = Buffer.alloc(68);
        this._write(buff);
        fs.writeSync(fd, buff, 0, buff.length, 0);
    }

    static _read(buff:  Buffer): ShpHeader {
        const header = new ShpHeader();
        header.fileCode = buff.readInt32BE(0);
        header.fileLength = buff.readInt32BE(24) * 2;
        header.version = buff.readInt32LE(28);
        header.fileType = buff.readInt32LE(32);
        header.minx = buff.readDoubleLE(36);
        header.miny = buff.readDoubleLE(44);
        header.maxx = buff.readDoubleLE(52);
        header.maxy = buff.readDoubleLE(60);

        return header;
    }

    _write(buff: Buffer) {
        const writer = new BufferWriter(buff);
        writer.writeInt32BE(this.fileCode);
        writer.seek(24);
        writer.writeInt32BE(this.fileLength * 0.5);
        writer.writeInt32LE(this.version);
        writer.writeInt32LE(this.fileType);
        writer.writeDoubleLE(this.minx);
        writer.writeDoubleLE(this.miny);
        writer.writeDoubleLE(this.maxx);
        writer.writeDoubleLE(this.maxy);
    }
}