const _ = require('lodash');

expect.extend({
    toBeGeneralRecord(record, id = 1) {
        expect(record).not.toBeNull();
        expect(record).not.toBeUndefined();
        expect(record.done).toBeFalsy();
        expect(record.result.id).toBe(id);
        expect(record.result.geometry).not.toBeNullOrUndefined();

        if(_.has(record.result, 'envelope')) {
            expect(record.envelope).not.toBeNullOrUndefined();
        }

        return { pass: true };
    },

    toBeNullOrUndefined(actual) {
        if (this.isNot) {
            expect(actual).not.toBeUndefined();
            expect(actual).not.toBeNull();
        } else {
            expect(actual).toBeUndefined();
            expect(actual).toBeNull();
        }

        return { pass: !this.isNot };
    },

    toBeClosePointTo(actual, expected, numDigit = 4) {
        let x = undefined;
        let y = undefined;

        if(expected instanceof Array) {
            [x, y] = expected;
        } 
        else {
            [x, y] = [expected.x, expected.y];
        }

        expect(actual.coordinates[0]).toBeCloseTo(x, numDigit);
        expect(actual.coordinates[1]).toBeCloseTo(y, numDigit);
        return { pass: true };
    },

    toBeClosePolyLineTo(actual, expected, numDigit = 4) {
        let pointArrays = _.chunk(expected, 2);
        expect(actual.coordinates.length).toBe(2);
        expect(actual.coordinates.length).toBe(pointArrays.length);
        for(let i in actual.coordinates) {
            expect(actual.coordinates[i][0]).toBeCloseTo(pointArrays[i][0], numDigit);
            expect(actual.coordinates[i][1]).toBeCloseTo(pointArrays[i][1], numDigit);
        }

        return { pass: true };
    }
});