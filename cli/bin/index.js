#!/usr/bin/env node
const argv = require("minimist")(process.argv.slice(2));
const GTD = require("../build/index");
const gtd = new GTD();

if (gtd.hasAction(argv._[0])) {
    gtd[argv._[0]].apply(gtd, argv._.slice(1));
} else if (argv._.length == 0) {
    gtd.show();
} else if (argv._.length == 1) {
    gtd.add(argv._[0]);
} else {
    throw new Error("Unsupported Action!");
}