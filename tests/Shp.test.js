require('./JestEx');
const _ = require('lodash');
const path = require('path');
const Shp = require('../libs/shp/Shp');
const citiesPath = path.join(__dirname, 'data/cities_e.shp');

describe('shapefile general tests', () => {
    test('get stream option test', async () => {
        const citiesShp = await (new Shp(citiesPath).open());
        let opt1 = citiesShp._getStreamOption(100);
        expect(_.keys(opt1).length).toBe(2);
        expect(opt1.autoClose).toBeTruthy();
        expect(opt1.start).toBe(100);
        // expect(_.isNumber(opt1.fd)).toBeTruthy();

        opt1 = citiesShp._getStreamOption(100, 108);
        expect(_.keys(opt1).length).toBe(3);
        expect(opt1.autoClose).toBeTruthy();
        expect(opt1.start).toBe(100);
        expect(opt1.end).toBe(108);
        // expect(_.isNumber(opt1.fd)).toBeTruthy();
        await citiesShp.close();
    });

    test('open close test 1', async () => {
        const citiesShp = new Shp(citiesPath);

        expect(citiesShp.isOpened).toBeFalsy();
        await citiesShp.open();
        expect(citiesShp.isOpened).toBeTruthy();
        expect(citiesShp._fd).not.toBeUndefined();

        await citiesShp.close();
        expect(citiesShp.isOpened).toBeFalsy();
        expect(citiesShp._fd).toBeUndefined();
    });

    test('open close test 2', async () => {
        const citiesShp = new Shp(citiesPath);

        expect(citiesShp.isOpened).toBeFalsy();
        await citiesShp.open();
        await citiesShp.open();
        expect(citiesShp.isOpened).toBeTruthy();
        expect(citiesShp._fd).not.toBeUndefined();

        await citiesShp.close();
        await citiesShp.close();
        expect(citiesShp.isOpened).toBeFalsy();
        expect(citiesShp._fd).toBeUndefined();
    });

    test('read header test 1', async () => {
        const citiesShp = new Shp(citiesPath);

        try {
            await citiesShp.open();
            const header = await citiesShp._readHeader();

            expect(header.fileCode).toBe(9994);
            expect(header.fileLength).toBe(533024);
            expect(header.version).toBe(1000);
            expect(header.fileType).toBe(1);
            expect(header.envelope.minx).toBeCloseTo(-174.1964, 4);
            expect(header.envelope.miny).toBeCloseTo(19.0972, 4);
            expect(header.envelope.maxx).toBeCloseTo(173.2376, 4);
            expect(header.envelope.maxy).toBeCloseTo(70.6355, 4);
        } finally {
            await citiesShp.close();
        }
    });

    test('read header test 2', async () => {
        try {
            const citiesShp = new Shp(citiesPath);
            await citiesShp._readHeader();
        } catch (err) {
            expect(err).toMatch(/Shapefile not opened/);
        }
    });
});

describe('shapefile test - polyline', () => {
    const lineShpPath = path.join(__dirname, 'data/Austinstreets.shp');

    test('read records test - polygine loop', async () => {
        const callbackMock = jest.fn();
        await loopRecords(lineShpPath, callbackMock);
        expect(callbackMock.mock.calls.length).toBe(13843);
    });

    test('read records test - polyline read first record', async () => {
        const lineShp = new Shp(lineShpPath);
        await lineShp.open();

        const records = await lineShp.iterator();
        let record = await records.next();

        expect(record).toBeGeneralRecord();
        expect(record.geometry).toBeClosePolyLineTo([-97.731192, 30.349088, -97.731584, 30.349305]);

        await lineShp.close();
    });
});

describe('shapefile test - point', () => {
    test('read records test - point loop', async () => {
        const callbackMock = jest.fn();
        await loopRecords(citiesPath, callbackMock);
        expect(callbackMock.mock.calls.length).toBe(19033);
    });

    test('read records test - point read first record', async () => {
        const record = await getFirstRecord(citiesPath);
        expect(record).toBeGeneralRecord();
        expect(record.geometry).toBeClosePointTo([-122.2065, 48.7168]);
    });
});

describe('shapefile test - polygon', () => {
    const shpPath = path.join(__dirname, 'data/USStates.shp');

    test('read records test - polygon loop', async () => {
        const callbackMock = jest.fn();
        await loopRecords(shpPath, callbackMock);
        expect(callbackMock.mock.calls.length).toBe(51);
    });

    test('read records test - polygon read first record', async () => {
        const record = await getFirstRecord(shpPath);
        expect(record).toBeGeneralRecord();

        expect(record.geometry.type).toEqual('Polygon');
        expect(record.geometry.coordinates.length).toBe(3);
        expect(record.geometry.coordinates[0].length).toBe(244);
        expect(record.geometry.coordinates[1].length).toBe(12);
        expect(record.geometry.coordinates[2].length).toBe(20);
        expect(record.geometry.coordinates[0][0]).toEqual(record.geometry.coordinates[0][243]);
        expect(record.geometry.coordinates[1][0]).toEqual(record.geometry.coordinates[1][11]);
        expect(record.geometry.coordinates[2][0]).toEqual(record.geometry.coordinates[2][19]);
    });
});

describe('read by id tests', () => {
    test('read single test', async () => {
        const shpPath = path.join(__dirname, 'data/USStates.shp');
        const shp = new Shp(shpPath);
        await shp.openWith(async () => {
            const recordIterator = await shp.iterator();

            let index = 0, ri = undefined;
            while((ri = await recordIterator.next()) && !ri.done) {
                ri = _.omit(ri, ['done']);
                const r = await shp.get(index);
                expect(r).toEqual(ri);
                index++;
            }
        });
    });
});

async function loopRecords(path, callback) {
    const shapefile = new Shp(path);
    await shapefile.open();
    const records = await shapefile.iterator();
    let record = null;
    while ((record = await records.next()) && !record.done) {
        callback();
    }
    await shapefile.close();
}

async function getFirstRecord(path) {
    const shapefile = new Shp(path);
    await shapefile.open();

    const records = await shapefile.iterator();
    const record = await records.next();
    await shapefile.close();

    return await Promise.resolve(record);
}