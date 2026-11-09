import { startBaseline } from './baseline';
startBaseline('http://127.0.0.1:4176').then(server => console.log('Current main synthetic baseline: '+server.url));
