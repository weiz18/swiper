/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": true}] */
/* eslint no-console: "off" */

const fs = require('fs');
const { rollup } = require('rollup');
const { default: babel } = require('@rollup/plugin-babel');
const replace = require('@rollup/plugin-replace');
const { default: resolve } = require('@rollup/plugin-node-resolve');
const Terser = require('terser');

const config = require('./build-config.js');
const banner = require('./banner.js');

function buildBundle(components, format, browser, cb) {
  const env = process.env.NODE_ENV || 'development';
  const external = format === 'umd' || browser ? [] : ['dom7', 'ssr-window'];
  let filename = 'swiper.bundle';
  if (format !== 'umd') filename += `.${format}`;
  if (format === 'esm' && browser) filename += '.browser';
  const output = env === 'development' ? 'build' : 'package';

  rollup({
    input: './src/swiper.js',
    external,
    plugins: [
      replace({
        delimiters: ['', ''],
        'process.env.NODE_ENV': JSON.stringify(env),
        '//IMPORT_COMPONENTS': components
          .map(
            (component) =>
              `import ${component.capitalized} from './components/${component.name}/${component.name}';`,
          )
          .join('\n'),
        '//INSTALL_COMPONENTS': components
          .map((component) => `${component.capitalized}`)
          .join(',\n  '),
        '//EXPORT': 'export default Swiper',
      }),
      resolve({ mainFields: ['module', 'main', 'jsnext'] }),
      babel({ babelHelpers: 'bundled' }),
    ],
  })
    .then((bundle) =>
      bundle.write({
        format,
        name: 'Swiper',
        strict: true,
        sourcemap: format === 'umd',
        sourcemapFile: `./${output}/${filename}.js.map`,
        banner,
        file: `./${output}/${filename}.js`,
      }),
    )
    .then((bundle) => {
      if (env === 'development' || !browser) {
        if (cb) cb();
        return;
      }
      const result = bundle.output[0];
      const minified = Terser.minify(result.code, {
        sourceMap: {
          content: env === 'development' ? result.map : undefined,
          filename: env === 'development' ? undefined : `${filename}.min.js`,
          url: `${filename}.min.js.map`,
        },
        output: {
          preamble: banner,
        },
      });

      fs.writeFileSync(`./${output}/${filename}.min.js`, minified.code);
      fs.writeFileSync(`./${output}/${filename}.min.js.map`, minified.map);
      if (cb) cb();
    })
    .catch((err) => {
      if (cb) cb();
      console.error(err.toString());
    });
}

function build() {
  const components = [];
  config.components.forEach((name) => {
    // eslint-disable-next-line
    const capitalized = name
      .split('-')
      .map((word) => {
        return word
          .split('')
          .map((char, index) => {
            if (index === 0) return char.toUpperCase();
            return char;
          })
          .join('');
      })
      .join('');
    const jsFilePath = `./src/components/${name}/${name}.js`;
    if (fs.existsSync(jsFilePath)) {
      components.push({ name, capitalized });
    }
  });

  buildBundle(components, 'esm', false, () => {});
  buildBundle(components, 'esm', true, () => {});
  buildBundle(components, 'umd', true, () => {});
  buildBundle(components, 'cjs', false, () => {});
}

module.exports = build;

build();