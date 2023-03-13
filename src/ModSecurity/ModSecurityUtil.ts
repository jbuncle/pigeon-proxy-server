
import { existsSync } from 'fs';
import path from 'path';

const possibleModSecurityDirs = [
    '/usr/local/modsecurity/',
    '/usr/',
    '/usr/local/',
];

const libraryDirs = [
    'lib/',
    'lib64/',
    './',
];

function findLibrary(modSecDirs: string) {
    for (const library of libraryDirs) {
        const libPath: string = path.join(modSecDirs, library, 'libmodsecurity.so');
        if (existsSync(libPath)) {
            return libPath;
        }
    }
    return null;
}

export function findModSec(): string | undefined {
    let lib = undefined;

    for (const modSecDir of possibleModSecurityDirs) {
        if (!lib) {
            lib = findLibrary(modSecDir);
        }
    }

    return lib;
}