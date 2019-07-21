import Envelope from "../../src/shp/Envelope";
import IEnvelope from "../../src/shp/IEnvelope";

describe('envelope helper test', () => {
    test('disjoined test', () => {
        let env1 = new Envelope(0, 0, 10, 10);
        let env2: IEnvelope = new Envelope(-20, -20, -10, -10);
        expect(Envelope.disjoined(env1, env2)).toBeTruthy();

        env2 = new Envelope(20, 0, 30, 10);
        expect(Envelope.disjoined(env1, env2)).toBeTruthy();

        env2 = new Envelope(-5, 0, 5, 10);
        expect(Envelope.disjoined(env1, env2)).toBeFalsy();

        env2 = { minx: -5, miny: 0, maxx: 5, maxy: 10 };
        expect(Envelope.disjoined(env1, env2)).toBeFalsy();

        expect(Envelope.disjoined(env1, undefined)).toBeFalsy();
        
        expect(Envelope.disjoined(undefined, undefined)).toBeFalsy();
    });
});