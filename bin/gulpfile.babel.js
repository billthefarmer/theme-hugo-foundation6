'use strict';

// Import
  import gulp       from 'gulp';
  import plugins    from 'gulp-load-plugins';
  import yargs      from 'yargs';
  import yaml       from 'js-yaml';
  import fs         from 'fs';
  import path       from 'path';
  import rimraf     from 'rimraf';
  import cp         from 'child_process';
  import gutil      from 'gulp-util';
  import browser    from 'browser-sync';
  import prettify   from 'gulp-jsbeautifier';

// Load configuration & path variables
  const $ = plugins(); // Load all Gulp plugins into one variable
  const PRODUCTION = !!(yargs.argv.production); // Check for --production flag
  var { COMPATIBILITY, PORT, PATHS } = loadConfig(); // Load settings from config.yml
  function loadConfig() { // Load Config
    let ymlFile = fs.readFileSync('config.yml', 'utf8');
    return yaml.load(ymlFile);
  }

// Set up additional
  var THEME = {}; var HUGO = {}; THEME.watch = {}; HUGO.watch = {};
  // Root paths
    THEME.root        =   path.dirname( path.resolve() ); // Full path of theme's root
    THEME.name        =   THEME.root.split( path.sep ).pop() // Full name of theme's root folder
    HUGO.root         =   path.join( THEME.root, '../..' ); // Full path of Hugo's root (assumes it is two directories up)
  // Special directories
    THEME.source      =   path.join(THEME.root, '/source'); // Full path of theme's source folder
    THEME.static      =   path.join(THEME.root, '/static'); // Full path of theme's static folder
    HUGO.public       =   path.join(HUGO.root, '/public'); // Full path of Hugo's public folder
  // Watch directories
    THEME.watch.scss  =   path.join(THEME.source, '/scss/**/*.scss');
    THEME.watch.js    =   path.join(THEME.source, '/js/**/*.js');
    THEME.watch.root  = [ path.join(THEME.root, '/archetypes/**/*.md'),
                          path.join(THEME.root, '/content/**/*.md'),
                          path.join(THEME.root, '/layouts/**/*'),
                          path.join(THEME.root, '/i18n/**/*'),
                          path.join(THEME.root, '/theme.toml') ];
    HUGO.watch.root   = [ path.join(HUGO.root, '/archetypes/**/*.md'),
                          path.join(HUGO.root, '/content/**/*.md'),
                          path.join(HUGO.root, '/layouts/**/*'),
                          path.join(HUGO.root, '/config.toml') ];

// SCSS build task
  function sass() {
    return gulp.src( path.join(THEME.source, '/scss/app.scss') )
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
      .pipe(gulp.dest( path.join(THEME.static, '/css') ))
      .pipe(browser.reload({ stream: true }));
  }

// JS build task
  function javascript() { // Combine JavaScript into one file
    return gulp.src(PATHS.javascript)
      .pipe($.sourcemaps.init())
      .pipe($.babel())
      .pipe($.concat('app.js'))
      .pipe($.if(PRODUCTION, $.uglify() // In production, the file is minified
        .on('error', e => { console.log(e); })
        ))
      .pipe($.if(!PRODUCTION, $.sourcemaps.write())) // In production, the JS is sourcemapped
      .pipe(gulp.dest( path.join(THEME.static, '/js') ));
  }

// Delete `public` folder
  function clean(done) {
    rimraf(HUGO.public, done);
  }

// Hugo build task
  gulp.task('hugo', (code) => {
    return cp.spawn('hugo', ['-t', THEME.name, '-s',HUGO.root], { stdio: 'inherit' })
      .on('error', (error) => gutil.log(gutil.colors.red(error.message)))
      .on('close', code);
  })

// Html5 lint task
  gulp.task('lint', function() {
    return gulp.src( path.join(HUGO.public, '/**/*.html') )
      .pipe(prettify({
        indent_size: 2,
        preserve_newlines: false
      }))
      .pipe(gulp.dest( HUGO.public ));
  })

// Start a server with BrowserSync to preview the site in
  function server(done) {
    browser.init({
      server: {
        baseDir: HUGO.public
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
  function watch() {
    gulp.watch(THEME.watch.scss).on('all', gulp.series(sass, 'hugo', 'lint', browser.reload));
    gulp.watch(THEME.watch.js).on('all', gulp.series(javascript, 'hugo', 'lint', browser.reload));
    gulp.watch(THEME.watch.root).on('all', gulp.series('hugo', 'lint', browser.reload));
    gulp.watch(HUGO.watch.root).on('all', gulp.series('hugo', 'lint', browser.reload));
  }

// `Package.json` -> Gulp tasks
  gulp.task('build', gulp.series( gulp.parallel(sass, javascript) )); // Build the 'static' folder.
  gulp.task('server', gulp.series( 'build', clean, 'hugo', 'lint', server, watch )); // Build the site, run the server, and watch for file changes.
