import _ from 'lodash';
import 'jest';
import Optional from '../../src/base/Optional';
import { Geometry } from 'ginkgoch-geom';

expect.extend({
    toBeGeneralRecord: (received: any, id = 1) => {
        const current = received;
        expect(current).not.toBeNull();
        expect(current).not.toBeUndefined();
        expect(current.id).toBe(id);

        return { pass: true, message: () => '' };
    },

    toBeNullOrUndefined: (actual: any) => {
        return { pass: _.isNull(actual) || _.isUndefined(actual), message: () => '' };
    },

    toBeClosePointTo: (actual: any, expected: any, numDigit = 4) => {
        let x = undefined;
        let y = undefined;

        if(expected instanceof Array) {
            [x, y] = expected;
        } 
        else {
            [x, y] = [expected.x, expected.y];
        }

        expect(actual[0]).toBeCloseTo(x, numDigit);
        expect(actual[1]).toBeCloseTo(y, numDigit);
        return { pass: true, message: () => '' };
    },

    toBeClosePolyLineTo: (actual: any, expected: any, numDigit = 4) => {
        let pointArrays = <number[][]>_.chunk(expected, 2);
        expect(actual.coordinates.length).toBe(2);
        expect(actual.coordinates.length).toBe(pointArrays.length);
        for(let i in <number[][]>actual.coordinates) {
            expect(actual.coordinates[i][0]).toBeCloseTo(pointArrays[i][0], numDigit);
            expect(actual.coordinates[i][1]).toBeCloseTo(pointArrays[i][1], numDigit);
        }

        return { pass: true, message: () => '' };
    }
});