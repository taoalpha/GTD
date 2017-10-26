const fs = require("fs");
const gulp = require("gulp");
const gulpConfig = require("./gulp.config");
gulpConfig.gulp = gulp;

fs.readdirSync("./tasks").forEach(file => {
  require("./tasks/" + file).call(gulpConfig);
});

gulp.task("default", ["ts", "watch"]);
