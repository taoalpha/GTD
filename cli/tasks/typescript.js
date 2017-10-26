let ts = require("gulp-typescript");

module.exports = function() {
  this.gulp.task("ts", done => {
    return this.gulp.src(this.sources.src)
      .pipe(ts())
      .pipe(this.gulp.dest(this.targets.dest));
  });
}
