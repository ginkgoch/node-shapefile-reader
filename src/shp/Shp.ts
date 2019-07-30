import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import assert = require('assert');
import { EventEmitter } from "events";
import { StreamReader } from 'ginkgoch-stream-io';
import { Envelope, IEnvelope, Geometry } from 'ginkgoch-geom';

import Shx from '../shx/Shx';
import ShpHeader from './ShpHeader';
import ShpIterator from './ShpIterator';
import Optional from '../base/Optional';
import GeomParser from './parser/GeomParser';
import IQueryFilter from '../shared/IQueryFilter';
import StreamOpenable from '../base/StreamOpenable';
import GeomParserFactory from './parser/GeomParserFactory';
import { Validators, ShapefileType, Constants } from "../shared";

const extReg = /\.\w+$/;
const CONTENT_START_OFFSET = 100;

export default class Shp extends StreamOpenable {
    filePath: string;
    _flag: string;
    _fd: number | undefined;
    _header: undefined | ShpHeader;
    _shpParser: Optional<GeomParser>;
    _shx: Optional<Shx>;
    _eventEmitter: EventEmitter | undefined;
    _reader: FileReader | undefined;

    constructor(filePath: string, flag = 'rs') {
        super();
        this.filePath = filePath;
        this._flag = flag;
        this._shpParser = new Optional<GeomParser>();
        this._shx = new Optional<Shx>();
    }

    private get __fd() {
        return <number>this._fd;
    }

    private get __header() {
        return <ShpHeader>this._header;
    }

    private get __shpParser() {
        return this._shpParser.value;
    }

    private get __shx() {
        return this._shx.value;
    }

    private get __reader() {
        return <FileReader>this._reader;
    }

    /**
     * @override
     */
    async _open() {
        Validators.checkFileExists(this.filePath);

        this._fd = fs.openSync(this.filePath, this._flag);
        this._header = await this._readHeader();
        this._shpParser = GeomParserFactory.create(this.__header.fileType);

        const filePathShx = this.filePath.replace(extReg, '.shx');
        if (fs.existsSync(filePathShx)) {
            this._shx.update(new Shx(filePathShx, this._flag));
            await this.__shx.open();
        }
    }

    /**
     * @override
     */
    async _close() {
        fs.closeSync(this.__fd);
        this._fd = undefined;
        this._header = undefined;
        this._shpParser.update(undefined);

        if (this._shx) {
            await this.__shx.close();
            this._shx.update(undefined);
        }
    }

    //TODO: remove async
    async _readHeader() {
        Validators.checkIsOpened(this.isOpened);
        const header = ShpHeader.read(this.__fd);
        return await Promise.resolve(header);
    }

    envelope() {
        Validators.checkIsOpened(this.isOpened);

        return new Envelope(
            this.__header.envelope.minx,
            this.__header.envelope.miny,
            this.__header.envelope.maxx,
            this.__header.envelope.maxy);
    }

    count() {
        Validators.checkIsOpened(this.isOpened);
        return this.__shx.count();
    }

    shapeType(): ShapefileType {
        Validators.checkIsOpened(this.isOpened);

        return this.__header.fileType;
    }

    async iterator() {
        Validators.checkIsOpened(this.isOpened);
        return await this._getRecordIterator(CONTENT_START_OFFSET);
    }

    /**
     * Gets shp record by id.
     * @param id The record id. Starts from 1.
     */
    async get(id: number): Promise<Geometry | null> {
        Validators.checkIsOpened(this.isOpened);

        const shxPath = this.filePath.replace(extReg, '.shx');
        assert(!_.isUndefined(this._shx), `${path.basename(shxPath)} doesn't exist.`);

        const shxRecord = this.__shx.get(id);
        if (shxRecord.length === 0) {
            return null;
        }

        const record = await this._get(shxRecord.offset, shxRecord.length);
        return record;
    }

    async _get(offset: number, length: number, envelope?: IEnvelope) {
        const iterator = await this._getRecordIterator(offset, offset + 8 + length);
        iterator.envelope = envelope;
        const result = await iterator.next();
        return result.value;
    }

    async records(filter?: IQueryFilter): Promise<Array<Geometry>> {
        Validators.checkIsOpened(this.isOpened);

        const filterOption = this._normalizeFilter(filter);
        const indexRecords = await this.__shx.records(filter);
        const records = new Array<Geometry>();

        let index = 0, total = indexRecords.length;
        for (let r of indexRecords) {
            const record = await this._get(r.offset, r.length, filterOption.envelope);
            if (record !== null) {
                records.push(record);
            }

            index++;
            if (this._eventEmitter) {
                this._eventEmitter.emit('progress', index, total);
            }
        }

        return records;
    }

    static _matchFilter(filter: IQueryFilter | null | undefined, recordEnvelope: IEnvelope): boolean {
        return filter === null || filter === undefined || _.isUndefined(filter.envelope) || (filter.envelope && !Envelope.disjoined(recordEnvelope, filter.envelope));
    }

    async _getRecordIterator(start?: number, end?: number) {
        const option = this._getStreamOption(start, end);
        const stream = fs.createReadStream(this.filePath, option);
        const sr = new StreamReader(stream);
        await sr.open();
        return new ShpIterator(sr, this.__shpParser);
    }

    //TODO: rename all removeAt to removeBy.
    /**
     * Remove record by a specific id.
     * @param {number} id The shp record id. Starts from 1.
     */
    removeAt(id: number) {
        Validators.checkIsOpened(this.isOpened);

        const recordShx = this.__shx.get(id);
        if (recordShx && recordShx.length > 0) {
            this.__shx.removeAt(id);

            const buff = Buffer.alloc(4);
            buff.writeInt32LE(0, 0);

            // write record length to  0.
            const position = recordShx.offset + 4;
            fs.writeSync(this.__fd, buff, 0, buff.length, position);
        }
    }

    /**
     * Update geometry by a specific record id.
     * @param id The record id to update. Starts from 1.
     * @param geometry The geometry to update.
     */
    updateAt(id: number, geometry: Geometry) {
        Validators.checkIsOpened(this.isOpened);

        const record = this._pushRecord(geometry, id);
        this.__shx.updateAt(id, record.offset, record.geomBuff.length);
    }

    push(geometry: Geometry) {
        Validators.checkIsOpened(this.isOpened);

        const record = this._pushRecord(geometry);
        this.__shx.push(record.offset, record.geomBuff.length);
    }

    _pushRecord(geometry: Geometry, id?: number): { geomBuff: Buffer, offset: number } {
        const parser = GeomParserFactory.create(this.__header.fileType);
        const geomBuff = parser.value.getGeomBuff(geometry);
        const recBuff = Buffer.alloc(geomBuff.length + 8);

        const currentId = id === undefined ? this.__shx.count() + 1 : id;
        recBuff.writeInt32BE(currentId, 0);
        recBuff.writeInt32BE(geomBuff.length / 2, 4);
        geomBuff.copy(recBuff, 8);

        const offset = this.__header.fileLength;
        fs.writeSync(this.__fd, recBuff, 0, recBuff.length, offset);

        this._updateHeader(geometry, recBuff.length);

        return { geomBuff, offset };
    }

    static createEmpty(filePath: string, fileType: ShapefileType): Shp {
        const header = new ShpHeader();
        header.fileType = fileType;

        const headerBuff = Buffer.alloc(Constants.SIZE_OF_SHP_HEADER);
        header._write(headerBuff);

        fs.writeFileSync(filePath, headerBuff);
        fs.copyFileSync(filePath, filePath.replace(/(.shp)$/g, '.shx'));

        const shp = new Shp(filePath, 'rs+');
        return shp;
    }

    private _updateHeader(geom: Geometry, geomLength: number) {
        this.__header.fileLength += geomLength;
        const geomEnvelope = geom.envelope();
        this.__header.envelope = Envelope.union(this.__header.envelope, geomEnvelope);
        this.__header.write(this.__fd);
        this.__header.write(this.__shx._fd as number);
    }
};