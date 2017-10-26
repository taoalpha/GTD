const path = require("path");
const runSequence = require("run-sequence");

module.exports = function() {
  this.gulp.task("cli-watch", done => {
    this.gulp.watch(path.join(this.general.cli, this.sources.src), ["cli-ts"]);
  });

  this.gulp.task("server-watch", done => {
    this.gulp.watch(path.join(this.general.server, this.sources.src), () => {
      runSequence("server-ts", "server-restart");
    });
  });
}
