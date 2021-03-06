import * as shared from '../../../src/shared';
import ShpReader from "../../../src/shp/ShpReader";
import GeomParserFactory from "../../../src/shp/parser/GeomParserFactory";
import { Point, MultiPolygon } from 'ginkgoch-geom';

describe('parser tests', () => {
    test('get parsers test', () => {
        let pointParser = GeomParserFactory.create(shared.ShapefileType.point);
        expect(pointParser).not.toBeNull();

        let polyLineParser = GeomParserFactory.create(shared.ShapefileType.polyLine);
        expect(polyLineParser).not.toBeNull();

        let multiPointParser = GeomParserFactory.create(shared.ShapefileType.multiPoint);
        expect(multiPointParser).not.toBeNull();

        let polygonParser = GeomParserFactory.create(shared.ShapefileType.polygon);
        expect(polygonParser).not.toBeNull();
    });

    test('get unsupported parser test', () => {
        let parser = GeomParserFactory.create(1000000);
        expect(parser.hasValue).toBeFalsy();
    });

    test('null shape parser test', () => {
        let parser = GeomParserFactory.create(shared.ShapefileType.nullShape);
        expect(parser.hasValue).toBeFalsy();
    });

    test('point shape parser test', () => {
        let [type, x, y] = [1, 34.5634, -89.2357];

        const buffer = Buffer.alloc(20);
        buffer.writeInt32LE(type, 0);
        buffer.writeDoubleLE(x, 4);
        buffer.writeDoubleLE(y, 12);
        let obj = GeomParserFactory.create(shared.ShapefileType.point);
        expect(obj.hasValue).toBeTruthy();

        obj.value.read(new ShpReader(buffer));
        let geom = obj.value.readGeom();
        expect(geom).toEqual(new Point(x, y));
    });

    test('point shape parser test - incorrect buffer', () => {
        let [type, x, y] = [2, 34.5634, -89.2357];

        const buffer = Buffer.alloc(20);
        buffer.writeInt32LE(type, 0);
        buffer.writeDoubleLE(x, 4);
        buffer.writeDoubleLE(y, 12);

        function parsePointBuffer() {
            let parser = GeomParserFactory.create(shared.ShapefileType.point);
            parser.value.read(new ShpReader(buffer));
        }
        expect(parsePointBuffer).toThrow(/Not a point record/);
    });

    it('write - point', () => {
        const point1 = [45, 56];

        const parser = GeomParserFactory.create(shared.ShapefileType.point);
        const buff = parser.value.getBuff(point1);

        const reader = new ShpReader(buff);
        const geomInfo = parser.value.read(reader) as any;
        const geom = geomInfo.readGeom();

        expect(geom.coordinates()).toEqual(point1);
    });

    it('write - multi point', () => {
        const points = [[45, 56], [78, 98]];

        const parser = GeomParserFactory.create(shared.ShapefileType.multiPoint);
        const buff = parser.value.getBuff(points);
        const reader = new ShpReader(buff);

        const geomInfo = parser.value.read(reader) as any;
        const geom = geomInfo.readGeom();
        expect(geom.coordinates()).toEqual(points);
    });

    it('write - line', () => {
        const line = [[45, 56], [78, 98]];

        const parser = GeomParserFactory.create(shared.ShapefileType.polyLine);
        const buff = parser.value.getBuff(line);
        const reader = new ShpReader(buff);

        const geomInfo = parser.value.read(reader) as any;
        const geom = geomInfo.readGeom();
        expect(geom.coordinates()).toEqual(line);
    });

    it('write - multi line', () => {
        const line = [[[45, 56], [78, 98]], [[34, 97], [46, 23]]];

        const parser = GeomParserFactory.create(shared.ShapefileType.polyLine);
        const buff = parser.value.getBuff(line);
        const reader = new ShpReader(buff);

        const geomInfo = parser.value.read(reader) as any;
        const geom = geomInfo.readGeom();
        expect(geom.coordinates()).toEqual(line);
    });

    it('write - polygon', () => {
        const line = [[[45, 56], [78, 98], [78, 98], [45, 56]], 
            [[34, 97], [46, 23], [46, 23], [34, 97]]];

        const parser = GeomParserFactory.create(shared.ShapefileType.polygon);
        const buff = parser.value.getBuff(line);
        const reader = new ShpReader(buff);

        const geomInfo = parser.value.read(reader) as any;
        const geom = geomInfo.readGeom() as MultiPolygon;

        expect(geom.children[0].coordinates()).toEqual([line[0]]);
        expect(geom.children[1].coordinates()).toEqual([line[1]]);
    });
});