import { ConsoleLoggerFactory, LogLevel, Logger } from '@jbuncle/logging-js';
Logger.setLoggerFactory(new ConsoleLoggerFactory(LogLevel.DEBUG));


import { App } from './App';

App.main();