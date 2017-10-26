module.exports = function() {
    this.gulp.task("watch", done => {
      this.gulp.watch(this.sources.src, ["ts"]);
    });
}
