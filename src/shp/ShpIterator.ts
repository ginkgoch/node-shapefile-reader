import _ from "lodash";
import { Envelope, IEnvelope, Geometry } from 'ginkgoch-geom';

import Shx from "../shx/Shx";
import ShpReader from "./ShpReader";
import Iterator from "../base/Iterator";
import Optional from "../base/Optional";
import GeomParser from "./parser/GeomParser";
import { FileStream } from 'ginkgoch-filestream';
import IQueryFilter from "../shared/IQueryFilter";
import FilterUtils from "../shared/FilterUtils";

export default class ShpIterator extends Iterator<Geometry | null> {
    
    _shx: Shx;
    _index: number;
    _stream: FileStream;
    _shpParser: GeomParser;
    _filter: { from: number, limit: number, to: number, envelope?: IEnvelope };

    /**
     * 
     * @param {FileStream} reader 
     * @param {ShpParser} shpParser
     */
    constructor(fd: number, shx: Shx, shpParser: GeomParser, filter?: IQueryFilter) {
        super();

        this._shx = shx;
        this._shpParser = shpParser;
        this._stream = new FileStream(fd);

        let filterOption = FilterUtils.normalizeFilter(filter);
        this._filter = _.assign(filterOption, { to: filterOption.from + filterOption.limit });

        const count = this._shx.count();
        if (this._filter.to > count + 1) {
            this._filter.to = count + 1;
        }
        
        this._index = this._filter.from - 1;
    }

    /**
     * @override
     */
    next(): Optional<Geometry | null> {
        this._index++;

        if (this._index >= this._filter.to) {
            return this._done();
        }

        const shxRecord = this._shx.get(this._index);
        this._stream.seek(shxRecord.offset);

        let buffer = this._stream.read(8);
        if (buffer === null || buffer.length !== 8) {
            return this._done();
        }

        const id = buffer.readInt32BE(0);
        const length = buffer.readInt32BE(4) * 2;
        let contentBuffer = this._stream.read(length);
        if (contentBuffer === null || contentBuffer.length !== length) {
            return this._done();
        }

        let reader = new ShpReader(contentBuffer);
        let content = this._shpParser.read(reader);
        if (content === null) {
            return this._dirty(content);
        }

        let geometry: Geometry | null = null;
        if (_.isUndefined(this._filter.envelope) || (this._filter.envelope && !Envelope.disjoined(content.envelope, this._filter.envelope))) {
            geometry = content.readGeom();
            geometry.id = id;
        }

        return this._continue(geometry);
    }
};