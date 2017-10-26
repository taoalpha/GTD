const fs = require("fs");
const gulp = require("gulp");
const gulpConfig = require("./gulp.config");
const runSequence = require("run-sequence");
gulpConfig.gulp = gulp;

fs.readdirSync("./tasks").forEach(file => {
  require("./tasks/" + file).call(gulpConfig);
});

gulp.task("cli", ["cli-ts", "cli-watch"]);
gulp.task("server", done => {
  runSequence("server-ts", "server-restart", "server-watch", done);
});
