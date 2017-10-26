const ts = require("gulp-typescript");
const path = require("path");

module.exports = function() {
  ["cli", "server"].forEach(name => {
    this.gulp.task(name + "-ts", done => {
      return this.gulp.src(path.join(this.general[name], this.sources.src))
        .pipe(ts())
        .pipe(this.gulp.dest(path.join(this.general[name], this.targets.dest)));
    });
  });
}
