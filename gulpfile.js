var del    = require('del'),
  gulp     = require('gulp'),
  usemin   = require('gulp-usemin'),
  zip      = require('gulp-zip'),
  manifest = require('./app/manifest.json');

gulp.task('copy', function() {
  return gulp.src([
      'app/**/*',
      '!app/bower_components',
      '!app/bower_components/**/*',
      '!**/*.js'
    ])
    .pipe(gulp.dest('dist'));
});

gulp.task('clean', function() {
  return del('dist');
});

gulp.task('build', ['clean', 'copy'], function() {
  return gulp.src('app/index.html')
    .pipe(usemin())
    .pipe(gulp.dest('dist'));
});

gulp.task('zip', ['build'], function () {
  return gulp.src('dist/**/*')
    .pipe(zip('about-now-' + manifest.version + '.zip'))
    .pipe(gulp.dest('build'));
});
