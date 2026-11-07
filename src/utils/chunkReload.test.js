import { isChunkLoadError, reloadOnceForNewVersion } from './chunkReload';

describe('isChunkLoadError', () => {
    test('reconnaît les erreurs de chargement de fichier d’une ancienne version', () => {
        expect(isChunkLoadError({ name: 'ChunkLoadError', message: 'Loading chunk 6465 failed.' })).toBe(true);
        expect(isChunkLoadError(new Error('Loading CSS chunk 12 failed.'))).toBe(true);
        expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x/a.js'))).toBe(true);
    });
    test('ignore les autres erreurs', () => {
        expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
        expect(isChunkLoadError(null)).toBe(false);
    });
});

describe('reloadOnceForNewVersion', () => {
    const original = window.location;
    beforeEach(() => {
        window.sessionStorage.clear();
        delete window.location;
        window.location = { reload: jest.fn() };
    });
    afterEach(() => { window.location = original; });

    test('recharge une fois, puis refuse pendant la minute suivante', () => {
        expect(reloadOnceForNewVersion(1000)).toBe(true);
        expect(reloadOnceForNewVersion(2000)).toBe(false);
        expect(window.location.reload).toHaveBeenCalledTimes(1);
        expect(reloadOnceForNewVersion(1000 + 61 * 1000)).toBe(true);
    });
});
