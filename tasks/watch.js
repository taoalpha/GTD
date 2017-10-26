const path = require("path");

module.exports = function() {
  this.gulp.task("cli-watch", done => {
    this.gulp.watch(path.join(this.general.cli, this.sources.src), ["cli-ts"]);
  });

  this.gulp.task("server-watch", done => {
    this.gulp.watch(path.join(this.general.server, this.sources.src), ["server-ts", "server-restart"]);
  });
}
