'use strict';

// Import
  import plugins  from 'gulp-load-plugins';
  import yargs    from 'yargs';
  import gulp     from 'gulp';
  import yaml     from 'js-yaml';
  import fs       from 'fs';
  import browser  from 'browser-sync';
  const gutil = require('gulp-util');
  const cp = require('child_process');

// Load Configuration
  const $ = plugins(); // Load all Gulp plugins into one variable
  const PRODUCTION = !!(yargs.argv.production); // Check for --production flag
  const { COMPATIBILITY, PORT, HUGO, THEME, PATHS } = loadConfig(); // Load settings from config.yml
  function loadConfig() { // Load Config
    let ymlFile = fs.readFileSync('config.yml', 'utf8');
    return yaml.load(ymlFile);
  }

// `Package.json` -> Gulp Tasks
  gulp.task('build', gulp.parallel(sass, javascript) ); // Build the "static" folder.
  gulp.task('server', gulp.series('build', server, watch) ); // Build the site, run the server, and watch for file changes.

// SCSS Build Task
function sass() {
  return gulp.src(THEME.source + '/scss/app.scss')
    .pipe($.sourcemaps.init())
    .pipe($.sass({
      includePaths: PATHS.sass
      })
      .on('error', $.sass.logError))
    .pipe($.autoprefixer({
      browsers: COMPATIBILITY
      }))
    .pipe($.if(PRODUCTION, $.cssnano())) // In production, the CSS is compressed
    .pipe($.if(!PRODUCTION, $.sourcemaps.write())) // In production, the CSS is sourcemapped
    .pipe(gulp.dest(THEME.static + '/css'));
    // .pipe(browser.reload({ stream: true }));
}

// JS Build Task
  function javascript() { // Combine JavaScript into one file
    return gulp.src(PATHS.javascript)
      .pipe($.sourcemaps.init())
      .pipe($.babel())
      .pipe($.concat('app.js'))
      .pipe($.if(PRODUCTION, $.uglify() // In production, the file is minified
        .on('error', e => { console.log(e); })
        ))
      .pipe($.if(!PRODUCTION, $.sourcemaps.write())) // In production, the JS is sourcemapped
      .pipe(gulp.dest(THEME.static + '/js'));
  }

// Hugo Build Task
  gulp.task('hugo', (code) => {
    return cp.spawn('hugo', ['-t', 'foundation', '-s',HUGO.root], { stdio: 'inherit' })
      .on('error', (error) => gutil.log(gutil.colors.red(error.message)))
      .on('close', code);
  })

// Start a server with BrowserSync to preview the site in
  function server(done) {
    browser.init({
      server: {
        baseDir: ["./", HUGO.root + "/public"],
        directory: true
      }, port: PORT
    });
    done();
  }
// Reload the browser with BrowserSync
  function reload(done) {
    browser.reload();
    done();
  }

// Watch for changes to scss / js / hugo
  var hugo_base_watch = [
    HUGO.root + '/archetypes/**/*.md',
    HUGO.root + '/content/**/*.md',
    HUGO.root + '/layouts/**/*',
    HUGO.root + '/config.toml'
  ];
  var hugo_themes_watch = [
    THEME.root + '/archetypes/**/*.md',
    THEME.root + '/content/**/*.md',
    THEME.root + '/layouts/**/*',
    THEME.root + '/i18n/**/*',
    THEME.root + '/theme.toml'
  ];
  function watch() {
    gulp.watch(THEME.source + '/scss/**/*.scss').on('all', gulp.series(sass, browser.reload));
    gulp.watch(THEME.source + '/js/**/*.js').on('all', gulp.series(javascript, browser.reload));
    gulp.watch(hugo_base_watch).on('all', gulp.series(browser.reload));
    gulp.watch(hugo_themes_watch).on('all', gulp.series(browser.reload));
  }
