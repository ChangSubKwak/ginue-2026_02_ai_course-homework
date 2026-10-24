const r = require(require('path').resolve(process.argv[2]));
console.log('SUMMARY:', r.summary, '| FATAL:', r.fatal);
console.log('--- FAILED ---'); r.failed.forEach(f => console.log(' x', f));
console.log('--- LOGS ---'); r.logs.forEach(l => console.log(' -', String(l).slice(0, 500)));
console.log('--- pageErrors ---', JSON.stringify(r.pageErrors)); console.log('--- consoleErrors ---', JSON.stringify(r.consoleErrors.slice(0, 5))); console.log('--- dialogs ---', JSON.stringify(r.dialogs));
console.log('passed', r.passed.length);
