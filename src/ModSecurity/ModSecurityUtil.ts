
import { existsSync } from 'fs';
import path from 'path';

const possibleModSecurityDirs = [
    '/usr/local/modsecurity/',
    '/usr/',
    '/usr/local/',
];

const libraryDirs = [
    'lib/',
    'lib/x86_64-linux-gnu',
    'lib/',
    'lib64/',
    './',
];

function findLibrary(modSecDirs: string): string | undefined {
    for (const library of libraryDirs) {
        const libPath: string = path.join(modSecDirs, library, 'libmodsecurity.so');
        console.log('Checking', libPath)
        if (existsSync(libPath)) {
            return libPath;
        }
    }
    return undefined;
}

export function findModSec(): string | undefined {

    for (const modSecDir of possibleModSecurityDirs) {
        const lib = findLibrary(modSecDir);
        if (lib !== undefined) {
            return lib;
        }
    }
    return undefined;
}